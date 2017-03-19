# Extending EventTarget with Observable

Currently the web has two primitives with which developers can build concurrent programs:

1. EventTarget
2. Promise

Unfortunately these primitives are difficult to compose without shared mutable state, a common source of bugs in concurrent applications like user interfaces. This proposal aims to make managing concurrency more ergonomic by adding a new interface to the DOM: `ObservableEventTarget`. An `ObservableEventTarget` is an interface which extends `EventTarget`, an object to which an event is dispatched when something has occurred. 

An `ObservableEventTarget` can be adapted to an `Observable` that dispatches the events received by that `ObservableEventTarget` to the `Observable`'s observers. 

`Observable`s share a common subset of `EventTarget` and `Promise` semantics. Consequently they can allow concurrent programs which use both EventTargets and Promises to be built compositionally.

## ObservableEventTarget API

The `ObservableEventTarget` interface introduces a new `on` method to `EventTarget`. The `on` method created an`Observable` which forwards events dispatched to the `ObservableEventTarget` to its Observers when the type of the event matches the type argument passed to the `on` method.

```
interface Event { /* https://dom.spec.whatwg.org/#event */ }

dictionary OnOptions {  
  // listen for an "error" event on the EventTarget,
  // and send it to each Observer's error method
  boolean receiveError = false;

  // member indicates that the callback will not cancel
  // the event by invoking preventDefault().
  boolean passive = false;,

  // handler function which can optionally execute stateful
  // actions on the event before the event is dispatched to
  // Observers (ex. event.preventDefault()).
  EventHandler handler = null;

  // member indicates that the Observable will complete after
  // one event is dispatched.
  boolean once = false;
}

interface ObservableEventTarget extends EventTarget {
  Observable<Event> on(DOMString type, optional (OnOptions or boolean) options);
}
```

Any implementer of `EventTarget` can additionally implement `ObservableEventTarget` to enable itself to be adapted to an `Observable` .

## Design Considerations

The semantics of `EventTarget`'s and `Observable`'s subscription APIs overlap cleanly. Both share the following semantics...

* the ability to synchronously subscribe and unsubscribe from notifications
* the ability to synchronously dispatch notifications
* errors thrown from notification handlers are reported to the host rather than being propagated

`EventTarget`s have additional semantics, most of which relate to the way events are propagated through the DOM. The aim of the proposed `on` method's API design is to allow these EventTarget-specific concerns to be handled at the point of adaptation. The `on` method accepts an `OnOptions` dictionary object. The `OnOptions` dictionary extends the DOM's `AddEventListenerOptions` dictionary object and adds two additional fields:

1. `receiveError`
2. `handler`

### The  `OnOptions` `receiveError` member 

The `receiveError` member specifies whether or not events with type `"error"` should be dispatched to each Observer's  `error` methods.

In the example below the  `on` method is used to create an `Observable` which dispatches an Image's "load" event to its observers. Setting the `"once"` member of the `OnOptions` dictionary to `true` results in a `complete`  notification being dispatched to the observers immediately afterwards. Once an Observer has been dispatched a `complete` notification, it is unsubscribed from the Observable and consequently the `ObservableEventTarget`.

```js
const displayImage = document.querySelector("#displayImage");

const image = new Image();
const load = image.on('load', { receiveError: true, once: true });
image.src = "./possibleImage";

load.subscribe({
  next(e) {
    displayImage.src = e.target.src;
  },
  error(e) {
    displayImage.src = "errorloading.png";
  },
  complete() {
    // this notification will be received after next ()
    // as a result of the once member being set to true
  }
})
```

Note that the `receiveError` member of the `OnOptions` object is set to true. Therefore if the Image receives an `"error"` Event, the Event is passed to the `error`  method of each of the `Observable`'s `Observer`s. This too results in unsubscription from all of the Image's underlying events.


### The  `OnOptions` `handler` member 

The `handler` callback function is invoked on the event object prior to the event being dispatched to the Observable's Observers. The handler gives developers the ability execute stateful operations on the Event object (ex. `preventDefault`, `stopPropagation`),  within the same tick on the event loop as the event is received. 

In the example below, event composition is used build a drag method for a button to allow it to be absolutely positioned in an online WYSWYG editor. Note that the `handler` member of the `OnOptions` object is set to a function which prevents the host browser from initiating its default action. This ensures that the button does not appear pressed when it is being dragged around the design surface.

```js
import "_" from "lodash-for-observable";

const button  = document.querySelector("#button");
const surface = document.querySelector("#surface");

// invoke preventDefault() in handler to suppresses the browser default action
// which is to depress the button.
const opts = { handler(e) { e.preventDefault(); } };
const mouseUps   = _(button.on( "mouseup",   opts));
const mouseMoves = _(surface.on("mousemove", opts));
const mouseDowns = _(surface.on("mousedown", opts));

const mouseDrags = mouseDowns.flatMap(() => mouseMoves.takeUntil(mouseUps));

mouseDrags.subscribe({
  next(e) {
    button.style.top = e.offsetX;
    button.style.left = e.offsetY;
  }
})
```

## Example Implementation

This is an example implementation of ObservableEventTarget. The `on` method delegates to
`addEventListener`, and adds a handler for an `"error"` event if the `receiveError` member on the `OnOptions` object has a value of `true`.

```js
class ObservableEventTarget extends EventTarget {
  on(type, opts) {
    return Observable(observer => {
      if (typeof opts !== "boolean") {
        opts = {};
      }
      else {
        opts = {
          capture: opts
        };
      }

      const handler = (typeof opts.handler === "function") ? opts.handler : null;
      const once = opts.once;

      const eventHandler = e => {
        try {
          if (handler != null) {
            handler(e);
          }

          observer.next(e);
        }
        finally {
          if (once) {
            observer.complete();
          }
        }
      };

      const errorHandler = observer.error.bind(observer);

      this.addEventListener(type, eventHandler, opts);

      if (opts.receiveError) {
        this.addEventListener("error", errorHandler)
      }

      // unsubscription logic executed when either the complete or
      // error method is invoked on Observer, or the consumer
      // unsubscribes.
      return () => {
        this.removeEventListener(type);

        if (receiveError) {
          this.removeEventListener("error", errorHandler);
        }
      };
    });
  }
}
```

## Why does the web need Observable?

Event-driven applications like user interfaces need to remain responsive while performing long-running operations. The `Promise.prototype.then` and `Promise.all` combinators allow for sequential and concurrent coordination of async operations respectively. Unfortunately these concurrency coordination primitives are insufficient for most user interfaces. Ignoring or queueing user events while performing an async operation negatively impacts application responsiveness. Furthermore dispatching a new async operation concurrently in response to each incoming event can introduce race conditions as these async operations may complete out of order.

**"Switch latest"** is a concurrency coordination pattern which cancels outstanding async operations when a new event is received. This concurrency coordination pattern offers event-driven applications a host of benefits:

1. maximizes responsiveness
2. guards against race conditions by eliminating out-of-order events
3. conserves resources by short-circuiting operations which are no longer necessary

To implement the "Switch Latest" pattern in a web app it is usually necessary to compose both of the web's async primitives: EventTarget and Promises. Unfortunately these two primitives are difficult to compose without the use of shared mutable state. This can increase the complexity of apps and introduce subtle bugs which are difficult to identify and reproduce.

`Observable` is primitive enough to express the `EventTarget` listening APIs and Promises and allow them to be composed without the use of shared mutable state. Observables are also well-suited for expressing the "Switch latest" concurrency coordination pattern. Extending EventTargets with Observable will give web developers access to a powerful primitive capable of ergonomically expressing a concurrency coordination pattern which is fundamental to responsive user interfaces.

### Use Case: Browsing the Images in a News aggregator

To demonstrate how difficult it is to implement the **Switch Latest** concurrency coordination pattern using the web's existing primitives, consider the use case of an app which allows users to browse through images posted on a news aggregator site.

![Aggregator](http://tc39.github.io/proposal-observable/aggregator.png)

A user can select from several image-heavy subs using the select box. Each time a new sub is selected the app downloads the first 300 post summaries from that sub. Once the posts have been loaded, the user can navigate through the image associated with each post using a next and previous button. When the user navigates to a new post the image is displayed as soon as it has been successfully preloaded. If the image load is not successful, or the post does have an associated image, a placeholder image is displayed. Whenever data is being loaded from the network, a transparent animated loading image is rendered over top of the image.

This app may appear simple, but naive implementations could suffer from any of the following race conditions:

* In the event requests for a subs posts complete out of order, images from old subs may be displayed after images from subs selected by the user more recently.
* In the event image preloads complete out of order, old images may be displayed after images selected by the user more recently.
* While a new sub is being loaded, the UI may continue responding to the navigation events for the current sub. Consequently images from the old sub may be displayed briefly before abruptly being replaced by those in the newly-loaded sub.

Note that **all of these bugs can be avoided through the use of the "Switch Latest" concurrency coordination pattern**, because each bug is caused by continuing to respond to notifications which have been rendered irrelevant by a more recent notification. The forthcoming sections will explore three possible implementations of this app, each of which will attempt to implement the "Switch Latest" pattern using different primitives:

1. "Switch Latest" with Async Functions and Promises
2. "Switch Latest" with EventTarget, Promises, and shared mutable state
3. "Switch Latest" with ObservableEventTarget and Promises

#### Solution 1: Async Functions and Promises

It's easy to understand why a developer might prefer to use async functions and Promises to build this app. Async functions and `Promise.all` make it much more ergonomic to manage concurrency than registering listeners on EventTargets. Unfortunately a Promise-based implementation is likely to be unresponsive, leaky, or both.

Let's take a look at a naive implementation using async functions:

```js
const subSelect = document.querySelector('#subSelect');
const displayedImage = document.querySelector("#displayedImage");
const titleLabel = document.querySelector("#titleLabel");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");

async function navigateSubs() {
  try {
    // loop through selected subs
    do {
      let sub = subSelect.value;
      let posts = await newsAggregator.getSubPosts(sub, 300);

      // loop through navigation events
      while(true) {
        let index = 0;
        let direction = await Promise.race(
          getNextEvent(nextButton, "click").then(() => 1),
          getNextEvent(previousButton, "click").then(() => -1));

        progressImage.style.visibility = "visible";

        let index = circularIndex(index + direction, posts.length);
        let summary = posts[index];

        try {
          // loadImage uses an unmounted Image object to preload images
          let image = await loadImage(summary.image);
          titleLabel.innerText = summary.title;
          displayedImage.src = summary.image || "./noimagefound.png";;
        }
        catch(e) {
          titleLabel.innerText = summary.title;
          displayedImage.src = "./errorloadingpost.png"
        }
      }
      // fires when the next sub select input's onchange event fires
      await getNextEvent(subSelect, "change");
    } while(true);
  }
  catch(e) {
    alert("News Aggregator is not responding. Please try again later.");
  }
}
```

This solution is both unresponsive and leaks memory. The application is unresponsive because it only listens for one of the following notifications at a time:

1. A new sub to be selected
2. A navigation button to be pressed
3. A image to be preloaded

Whenever the application is listening for one of these notifications, it is ignoring the others. This means that changes to the sub will be ignored when the application is listening for navigation events, and so on. This problem can be solved by concurrently listening for all notifications whenever the function is awaiting a particular notification using `Promise.race`. For example, the navigation handling below has been modified to preempt listening for navigation events when the sub has changed.

```js
try {
  // snip...
  let direction = await Promise.race(
    getNextEvent(nextButton, "click").then(() => 1),
    getNextEvent(previousButton, "click").then(() => -1),
    getNextEvent(subSelect, "change").
      then(() => Promise.reject(new NewSubSelectedError())));
  // snip...
} catch(e) {
  if (!(e instanceof NewSubSelectedError))
    throw e;
}
```

In the modified example above `Promise.race` concurrently listens for both the navigation and sub change events and notifies as soon as any of the Promises resolve. Unfortunately the lack of support for Promise cancellation means that handlers attached to either of the Promises which did not resolve will remain attached and leak memory.

#### Solution 2: EventTarget, Promises, and State

The previous solution processed different event streams sequentially, leading to poor responsiveness. This solution subscribes to multiple EventTargets and Promises concurrently, thereby improving responsiveness. Unfortunately this improved concurrency introduces the risk of race conditions which must be guarded against with shared mutable state.

```js
const subSelect = document.querySelector('#subSelect');
const displayedImage = document.querySelector("#displayedImage");
const titleLabel = document.querySelector("#titleLabel");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");

let index;

// shared mutable state used to coordinate concurrency
let posts;
let currentOperation = 0;

function showProgress() {
  progressImage.style.visibility = "visible";
}

function switchImage(direction) {
  // guard against navigating while a new sub is being loaded
  if (posts == null) {
    return;
  }
  showProgress();

  if (posts) {
    index = circularIndex(index + direction, posts.length)
  }

  const summary = posts[index];

  // capture current operation id in closure so it can be used to
  // confirm operation is not outdated when Promise resolves
  let thisOperation = ++currentOperation;
  return preloadImage(summary.image).
    then(
      () => {
        // short-circuit this is no longer the current operation
        if (thisOperation === currentOperation) {
          titleLabel.innerText = summary.title
          displayedImage.src = detail.image || "./noimagefound.gif"
        }
      },
      e => {
        // short-circuit this is no longer the current operation
        if (thisOperation === currentOperation) {
          titleLabel.innerText = summary.title
          displayedImage.src = "./errorloadingpost.png";
        }
      });
}

function subSelectHandler() {
  showProgress();

  let sub = subSelect.value;
  // indicate a new set of posts is being loaded to guard
  // against responding to navigation events in the interim
  posts = null;

  // capture current operation id in closure so it can be used to
  // confirm operation is not outdated when Promise resolves
  let thisOperation = ++currentOperation;
  newsAggregator.
      getSubPosts(sub).
      then(
        postsResponse => {
          if (thisOperation === currentOperation) {
            index = 0;
            posts = postsResponse;
            return switchImage(0);
          }
        },
        e => {
          // unsubscribe from events to avoid putting unnecessary
          // load on news aggregator when the server is down.
          nextButton.removeEventListener("click", nextHandler);
          previousButton.removeEventListener("click", previousHandler);
          subSelect.removeEventListener("change", subSelectHandler);
          alert("News Aggregator is not responding. Please try again later.");
        });
});

function nextHandler() {
  switchImage(1)
};

function previousHandler() {
  switchImage(-1);
};

subSelect.addEventListener("change", subSelectHandler);
nextButton.addEventListener("click", nextHandler);
previousButton.addEventListener("click", previousHandler);


// load current sub
subSelectHandler();
```

This app improves on the previous app in the following ways:

* it can concurrently respond to sub changes, navigation events, and image loads.
* memory leaks associated with retained handlers have been eliminated by relying on `EventTarget`s ability to send multiple events to a single subscription.

However this solution is also complex, because it relies on mutable state to implement the "Switch Latest" concurrency coordination. To ensure that outdated operations are not executed, shared mutable state is used to track the operation with highest priority. Regrettably the lack of support for Promise cancellation forces the developer to take explicit steps to avoid responding to notifications which are no longer relevant.  Consider the guards inserted at various places in the code above to prevent the execution of operations which are no longer needed.

```
if (posts == null) {
  return;
}

// ...snip...

if (thisOperation !== currentOperation) {
  // ...snip...
}

// ...snip...

if (thisOperation !== currentOperation) {
  // ...snip...
}

// ...snip...

nextButton.removeEventListener("click", nextHandler);
previousButton.removeEventListener("click", previousHandler);
subSelect.removeEventListener("change", subSelectHandler);
```

Yet more shared mutable state is necessary because EventTarget and Promise do not compose. Note that in order to make the values resolved by `Promises` available to `EventTarget` handlers, it is necessary to write them to the shared mutable `posts` variable.

#### Solution 3: ObservableEventTarget and Promises

The previous solution relied on mutable state to implement the "Switch Latest" concurrency coordination pattern. Using Observable it is possible to avoid using shared mutable state for concurrency coordination by using the `switchLatest` and `switchMap` functions offered by userland libraries.

The `switchLatest` combinator allows the "Switch Latest" pattern to be implemented without introducing mutable state into user code. The `switchLatest` combinator accepts a multi-dimensional Observable, and returns an  Observable flattened by one dimension. As soon the outer Observable notifies an inner Observable, `switchLatest` unsubscribes from the inner Observable to which it was subscribed and subscribes to the **latest** Observable.

The behavior of the `switchLatest` combinator is best demonstrated visually. Consider the following encoding of an Observable of numbers:

```<|,,,1,,,,,5,,,,,,,9,,,,|>```

In the encoding above each ```<|``` is the point at which the Observable is subscribed, and each ```|>``` indicates a `complete` notification. Furthermore each `,` represents 10 milliseconds and each number represents a `next` notification to the Observer. Given the encoding above a two-dimensional Observable can be encoded like this...

```
<|
,,,,,<|,,,,,5,,,,2,,,,,,3,,,,|>
,,,,,,,,,<|,,,,,,,,8,,,,,,|>
,,,,,,,,,,,,,,,,,,,,,<|,,,,,,,,,9|>
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|>
```

When the `switchLatest` combinator is applied to flatten the two-dimensional Observable above the following result is produced.

`<|,,,,,,,,,,,,,,,,8,,,,,,,,,,,9,,,,,,,|>`

Note that none of the data in the first inner `Observable` makes it into the flattened stream, because the first inner `Observable` does not notify prior to the notification of a new inner `Observable`. Consequently the `switchLatest` combinator unsubscribes from the previous inner `Observable` before that `Observable` has the opportunity to notify. The second inner `Observable` only has the opportunity to notify `8` prior to the arrival of a new inner `Observable`, which notifies `9` and completes. Shortly thereafter the outer `Observable` completes, thereby completing the flattened Observable.

Here's an example of `switchLatest` being used to build an auto-complete box:

```js
import _ from "lodash-for-observable";
const textbox = document.querySelector("#textbox");
let keyups = _.on(textbox, "keyup");

keyups.
  // disregard outstanding request and switch to
  // new one created by projection function.
  map(() =>
    // userland "lodash-for-observable" library
    // automatically adapts Promises into Observables
    getSearchResultSet(textbox.value)).
  switchLatest().
  subscribe({
    next(resultSet) {
      display(resultSet);
    },
    error(error) {
      alert(error);
    }
  });
```

Note that using `switchLatest` guarantees that search results for a particular search not come back out-of-order by switching to the the result of the latest Promise each time a key is pressed.

In the example above the `switchLatest` operation is applied to the result of a `map` operation. The `switchMap` method is a shorthand for this common pattern. Here is the example above rewritten to use `switchMap`.

```js
import _ from "lodash-for-observable";
const textbox = document.querySelector("#textbox");
let keyups = _.on(textbox, "keyup");

keyups.
  // disregard outstanding request and switch to
  // new one created by projection function.
  switchMap(() =>
    // userland "lodash-for-observable" library
    // automatically adapts Promises into Observables
    getSearchResultSet(textbox.value)).
  subscribe({
    next(resultSet) {
      display(resultSet);
    },
    error(error) {
      alert(error);
    }
  });
```

Here's an algorithm for the Image Viewer app which uses `switchMap` to avoid race conditions without relying on shared mutable state.

```js
import newsAggregator from "news-aggregator";
import _ from "lodash-for-observable";

const previousClicks = _(previousButton.on("click"));
const nextClicks = _(nextButton.on("click"));

const getNavigatedItems = (array) =>
  _.merge(
    Observable.of(0),
    backClicks.map(() => -1),
    forwardClicks.map(() => 1)).
    // <|0,,,,,,,,,,1,,,,,,,,,1,,,,,,,-1,,,,,,,,-1,,,,,,,,
    scan(
      (index, direction) =>
        circularIndex(index + direction, length)).
    // <|0,,,,,,,,,,1,,,,,,,,,2,,,,,,,,1,,,,,,,,0,,,,,,,,,
    map(index => array[index]);
    // <|item,,,,,,,item,,,,,,item,,,,,,item,,,,item,,,,,,

const subSelect = document.querySelector('#subSelect');
// ,,,,,,"pics",,,,,,"humour",,,,,,,,,,,,"cute",,,,,,,
const subs = _(subSelect.on("change")).map(e => e.target.value);

_.
  merge(backClicks, forwardClicks, subs).
  subscribe(() => progressImage.style.visibility = "visible");

const postsWithImages =
  subs.
    // ,,,,,"pics",,,,"humour",,,,,,,,,,"cute",,,,,,,,
    switchMap(sub => // ignore outstanding sub requests, nav events, and image loads and switch to new sub
      newsAggregator.getSubPosts(sub, 300).
        //,,,[ {title:"My Cat", image:"http://"}, {title:"Meme",image:"http://"}, ...],,,,,[...],,,,
        switchMap(posts => getNavigatedItems(posts)).
        //,,,{title:"My Cat",image:"http://"},,,,,,,,{title:"Meme",image:"http://"},,,,,,,,,,,,,       
        switchMap(post => { // ignore outstanding image loads, switch to new post
          const image = new Image();
          image.src = post.image;
          return _.(image.on('load', { receiveError: true, once: true })).
            map(() => post).
            catch(error => Observable.of({...post, image: "./errorloadingpost.png"}));
        }));
        //,,,,,,,,,,,,{title: "My Cat",image: "http://...""},,,,,,,{title:"Meme",image:"http://"},,,,,,,,,

const displayedImage = document.querySelector("#displayedImage");
const titleLabel = document.querySelector("#titleLabel");
const progressImage = document.querySelector("#progressImage");

postDetails.subscribe({
  next({title, image}) {
    progressImage.style.visibility = "hidden";
    titleLabel.innerHTML = title;
    displayedImage.src = image;
  }
  error(e) {
    alert("News Aggregator is not responding. Please try again later.");
  }
});
```

Note that the resulting code is shorter than the correct previous solution. More importantly the code contains does not utilize any shared mutable state for concurrency coordination, allowing every identifier to be labeled `const.` The only shared mutable state is the DOM elements, but this state is not used to coordinate concurrency and must be changed to fulfill the requirements.

## A More Compositional Web with ObservableEventTarget

ObservableEventTarget offers the possibility of composing the web's async primitives.
