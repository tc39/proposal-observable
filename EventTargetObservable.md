# Extending EventTarget with Observable

This proposal would add a new interface to the DOM: `EventTargetObservable`. Any implementer of `EventTarget` could choose to implement this interface as well. `EventTargetObservable` defines an `on` method which can be used to adapt an `EventTarget` to an `Observable`.

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

interface EventTargetObservable extends EventTarget {
  Observable<Event> on(DOMString type, optional (OnOptions or boolean) options);
}
```

The `EventTargetObservable` object represents a target to which an event is dispatched when something has occurred. Calling the `EventTargetObservable`'s `on` method produces an `Observable` which conditionally forwards dispatched events to the `Observable`'s `Observer`s. An event received by the `EventTargetObservable` is dispatched to the observers of an `Observable` created by `on` provided the type of the event matches the type argument passed to the `on` method when it was invoked.

The `on` method accepts an `OnOptions` dictionary object. The `OnOptions` dictionary extends the DOM's `AddEventListenerOptions` dictionary object and adds two additional fields:

1. `receiveError`
2. `handler`

The `receiveError` member indicates whether or not events with type error are dispatched to Observers error methods.

The `handler` callback function is invoked on the event object prior to the event being dispatched to the Observable's Observers. The handler is intended to be used to allow developers to execute stateful operations on the Event object within the current tick.

## Design Considerations

The semantics of `EventTarget` and `Observable` cleanly overlap by design. Both `EventTarget` and `Observable` share the following semantics...

* the ability to synchronously subscribe and unsubscribe from notifications
* the ability to synchronously dispatch notifications
* errors thrown from notification handlers are reported to the host, but are not propagated

EventTargets also support additional semantics beyond those of Observable, such as the those relating to the propagation of events through the DOM. Furthermore EventTargets exclusively notify Event objects, which support several mutable operations.

The aim of this proposal is to provide an API that allow inputs relating to `EventTarget` semantics to be specified at the point of adaptation, thereby allowing the semantics of EventTarget to be narrowed to those of Observable without impacting expressiveness.

## Example Usage

### Image Preloading

In the example below, an Observable is created which dispatches a load event completes when an image successfully preloads, and dispatches an error notification if the image load is unsuccessful.

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
  }
})
```

### Custom Gestures with Event Composition

In this example event composition is used to allow an HTML button to be absolutely positioned in an online WYSWYG editor using drag n' drop. The handler member of the event options is set to a function which prevents the default action of the browser prior to dispatching the event.

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

### Composing Event Streams and Async Requests

<Insert auto complete box example here>

## Example Implementation

This is an example implementation of EventTargetObservable. The `on` method delegates to
`addEventListener`, and adds a handler for an "error" event if the receiveError field on the options object is set to true.

```js
class EventTargetObservable extends EventTarget {
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

## Rationale for Observables on the Web

Event-driven applications like user interfaces need to remain responsive while performing long-running operations. The `Promise.prototype.then` and `Promise.all` combinators allow for sequential and concurrent coordination of async operations respectively. Unfortunately these concurrency coordination primitives are insufficient for most user interfaces. Ignoring or queueing user events while performing an async operation negatively impacts application responsiveness. Furthermore dispatching a new async operation concurrently in response to each incoming event can introduce race conditions as these async operations may complete out of order.

**"Switch latest"** is a concurrency coordination pattern which cancels outstanding async operations when a new event arrives. This concurrency coordination pattern offers event-driven applications a host of benefits:

1. maximizes responsiveness
2. guards against race conditions by eliminating out-of-order events
3. conserves resources by short-circuiting operations which are no longer necessary

**"Switch Latest"** is a common concurrency coordination pattern in UIs. To implement this pattern in a web app it is usually necessary to compose both of the web's async primitives: EventTarget and Promises. Unfortunately these two primitives are difficult to compose without the use of shared mutable state. This can increase the complexity of apps and introduce subtle bugs which are difficult to identify and reproduce.

`Observable` is primitive enough to express the `EventTarget` listening APIs and Promises and allow them to be composed without the use of shared mutable state. Observables are also well-suited for expressing the **"Switch latest"** concurrency coordination pattern. Extending EventTargets with Observable will give web developers a primitive capable of ergonomically expressing a concurrency coordination pattern which is fundamental to user interfaces.

### Use Case: Browsing the Images in a News aggregator

To demonstrate how difficult it is to implement the **Switch Latest** concurrency coordination pattern using the web's existing primitives, consider the use case of an app which allows users to browse through images posted on a news aggregator site.

![Aggregator](http://tc39.github.io/proposal-observable/aggregator.png)

A user can select from several image-heavy subs using the select box. Each time a new sub is selected the app downloads the first 300 post summaries from that sub. The user can navigate through the images for a sub using a next and previous button. When the user navigates the image for the post is preloaded and displayed if the image load is successful. If the image load is not successful, or the post does have an associated image, a placeholder image is displayed. Whenever data is being loaded form the network, a translucent animated image is rendered over top of the screen.

This app may appear simple, but naive implementations could suffer from any of the following race conditions:

* In the event requests for a subs posts complete out of order, images from old subs may be displayed after images from subs selected by the user more recently.
* In the event image preloads complete out of order, old images may be displayed after images selected by the user more recently.
* While a new sub is being loaded, the UI may continue responding to the navigation events for the current sub. Consequently images from the old sub may be displayed briefly before abruptly being replaced by those in the new sub, leading to a poor user experience.

Note that **all of these bugs can be avoided through the use of the "Switch Latest" concurrency coordination pattern**, because each bug is caused by continuing to respond to notifications which have been rendered irrelevant by a more recent notification. The forthcoming sections will explore three possible implementations of this app, each of which will attempt to implement the "Switch Latest" pattern using different primitives:

1. "Switch Latest" with Async Functions and Promises
2. "Switch Latest" with EventTarget, Promises, and shared mutable state
3. "Switch Latest" with EventTargetObservable and Promises

#### Solution 1: Async Functions and Promises

It's easy to understand why a misguided developer might attempt to use async functions and Promises to build this app. Async functions and `Promise.all` make it much more ergonomic to coordinate concurrency than registering listeners on EventTargets. Unfortunately a Promise-based implementation is likely to be unresponsive, leaky, or both.

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

In the modified example above `Promise.race` concurrently listens for both the navigation and sub change events and notifies as soon as any of the Promises resolve. Unfortunately the lack of support for Promise cancellation means that handlers attached to either of the Promises which did not resolve will remain attached and leak memory. This will leak to memory leaks over time. Note that the inability to cancel Promises makes it impractical to use them for preemptive concurrency.

#### Solution 2: EventTarget, Promises, and State

The previous solution which used async functions and Promises causing events to be sequentially processed. This in turn degraded responsiveness. This solution subscribes to multiple EventTargets and Promises concurrently, thereby improving responsiveness. Unfortunately the increased concurrency introduces the risk of race conditions which must be guarded against with shared mutable state.

```js
const subSelect = document.querySelector('#subSelect');
const displayedImage = document.querySelector("#displayedImage");
const titleLabel = document.querySelector("#titleLabel");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");

let sub;
let posts;
let index;
let currentOperation = 0;

function showProgress() {
  progressImage.style.visibility = "visible";
}

function switchImage(direction) {
  // guard against navigating while a new sub is being downloaded
  if (posts == null) {
    return;
  }
  showProgress();

  if (posts) {
    index = circularIndex(index + direction, posts.length)
  }

  let summary = posts[index];

  let thisOperation = ++currentOperation;
  let imageLoad = preloadImage(summary.image).
    then(
      () => {
        if (thisOperation !== currentOperation) {
          titleLabel.innerText = summary.title
          displayedImage.src = detail.image || "./noimagefound.gif"
        }
      },
      e => {
        if (thisOperation !== currentOperation) {
          titleLabel.innerText = summary.title
          displayedImage.src = "./errorloadingpost.png";
        }
      });

  outstandingImageLoad = imageLoad;

  return imageLoad;
}

nextButton.addEventListener("click", () => switchImage(1));
previousButton.addEventListener("click", () => switchImage(-1));

subSelect.addEventListener("change", () => {
  showProgress();
  sub = subSelect.value;
  posts = null;

  let thisOperation = ++currentOperation;

  newsAggregator.
      getSubPosts(sub).
      then(
        postsResponse => {
          if (thisOperation !== currentOperation) {
            index = 0;
            posts = postsResponse;
            return switchImage(0);
          }
        },
        e => {

        });
});
```

The solution above is considerably more difficult to follow than the solution which uses async function. However at any time the app is ready to respond to sub changes, navigation events, and image loads. Furthermore this solution does not contain the memory leaks.

Relying on mutable state for concurrency coordination is challenging, because the developer must take positive steps to prevent irrelevant operations from taking place. Consider the guard code inserted at various places in the code above to prevent executing operations which are no longer needed.

#### Solution 3: EventTargetObservable and Promises

The previous solution relied on mutable state to implement the "Switch Latest" pattern. Using Observable it is possible to avoid using shared mutable state for concurrency coordination by using the `switchLatest` and `switchMap` functions offered by userland libraries.

Most popular Observable combinator libraries offer a version of the `switchLatest` combinator. This combinator allows the "Switch Latest" pattern to be implemented without introducing mutable state into user code. The `switchLatest` combinator takes a multi-dimensional Observable, and returns a flattened Observable. As soon the outer Observable notifies an inner Observable, `switchLatest` unsubscribes from the inner Observable to which it is subscribed and subscribes to the **latest** Observable.

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

If the `switchLatest` combinator was applied to the Observable above, the resulting Observable would look like this:

`<|,,,,,,,,,,,,,,,,8,,,,,,,,,,,9,,,,,,,|>`

Note that none of the data in the first inner Observable makes it into the flattened stream, because the inner Observable does not notify prior to the notification of a new inner Observable. Consequently the `switchLatest` combinator unsubscribes from the previous inner Observable before that Observable has the opportunity to notify. The second inner Observable only has the opportunity to notify `8` prior to the arrival of a new inner Observable, which notifies `9` and completes. Shortly thereafter the outer Observable completes, thus completing the flattened Observable.

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

Note that using `switchLatest` guarantees that search results for a particular search not come back out-of-order.

In the example above that the `switchLatest` operation is applied to the result of a `map` operation. The `switchMap` method is a shorthand for this common pattern. Here is the example above rewritten to use `switchMap`.

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

Here's an algorithm for the Image Viewer app which uses `switchMap` to avoid race conditions rather than shared mutable state.

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
        flatMap(posts => getNavigatedItems(posts)).
        //,,,{title:"My Cat",image:"http://"},,,,,,,,{title:"Meme",image:"http://"},,,,,,,,,,,,,       
        switchMap(post => { // ignore outstanding image loads, switch to new post
          const image = new Image();
          image.src = post.image;
          return _.(image.on('load', { receiveError: true, once: true })).
            catch(
              () => post,
              error  => ({...post, image: "./errorloadingpost.png"}));
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

## A More Compositional Web with EventTargetObservable

EventTargetObservable offers the possibility of composing the web's async primitives.
