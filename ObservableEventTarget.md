# Extending EventTarget with Observable

Currently the web has two primitives with which developers can build concurrent programs:

1. EventTarget
2. Promise

Unfortunately the inability to compose these two primitives makes it is difficult to coordinate concurrency without the use of shared mutable state. This introduces incidental complexity into web applications, and increases the likelihood of race conditions.

This proposal aims to enable more composable approaches to concurrency coordination by adding a new interface to the DOM: `ObservableEventTarget`. `ObservableEventTarget` is an interface which extends `EventTarget` with an `on` method. When the `on` method is invoked with a event type argument, an Observable is created. Events of the same type which are subsequently dispatched to the `ObservableEventTarget` are also dispatched to any observers observing the Observable. `Observable`s shares a common subset of `EventTarget` and `Promise` semantics, allowing concurrent programs which use both primitives to be built compositionally. 

## ObservableEventTarget API

The `ObservableEventTarget` interface inherits from `EventTarget` and introduces a new method: `on`. The `on` method creates an`Observable` and forwards events dispatched to the `ObservableEventTarget` to the Observers of that Observable.

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

Any implementation of `EventTarget` can also implement the `ObservableEventTarget` interface to enable instances to be adaptated to `Observable`s.

## Design Considerations

The semantics of `EventTarget`'s and `Observable`'s subscription APIs overlap cleanly. Both share the following semantics...

* the ability to synchronously subscribe and unsubscribe from notifications
* the ability to synchronously dispatch notifications
* errors thrown from notification handlers are reported to the host rather than being propagated

`EventTarget`s have semantics which control the way events are propagated through the DOM. The `on` method accepts an `OnOptions` dictionary object which allow event propagation semantics to be specified when the ObservableEventTarget is adapted to an Observable. The `OnOptions` dictionary extends the DOM's `AddEventListenerOptions` dictionary object and adds two additional fields:

1. `receiveError`
2. `handler`

### The  `OnOptions` `receiveError` member

The `receiveError` member specifies whether or not events with type `"error"` should be passed to the  `error` method on the Observable's Observers.

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

Note that the `receiveError` member of the `OnOptions` object is set to true. Therefore if the Image receives an `"error"` Event, the Event is passed to the `error`  method of each of the `Observable`'s `Observer`s. This, too, results in unsubscription from all of the Image's underlying events.


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
const mouseDowns = _(button.on( "mousedown", opts));
const mouseMoves = _(surface.on("mousemove", opts));
const mouseUps   = _(surface.on("mouseup",   opts));

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

## Problem: EventTargets and Promises are difficult to Compose

Web applications need to remain responsive to user input while performing long-running operations like network requests. Consequently web applications often subscribe to EventTargets and Promises concurrently. In some circumstances, an application may start additional concurrent operations when each new event of a particular type is received (ex. a web browser starting a new concurrent download for each file link clicked). However web applications often respond to events by **canceling or ignoring the output of one or more concurrently running tasks** (ex. canceling an outstanding request for a view's data when the user navigates elsewhere). 

Unfortunately this common concurrency coordination pattern, in which outstanding network requests are canceled when an event of a certain type is received, is challenging to implement compositionally using EventTargets and Promises. These challenges will be demonstrated using the use case of an image browser app created for a news aggregator.

### Use Case: Browsing the Images in a News aggregator

Consider the use case of a web app which allows users to browse through images posted on a news aggregator site.

![Aggregator](http://tc39.github.io/proposal-observable/aggregator.png)

A user can select from several image-oriented subs using a select box. Each time a new sub is selected, the app downloads the first 300 post summaries from that sub. Once the posts have been loaded, the user can navigate through the images associated with each post using a next and previous button. When the user navigates to a new post, the image is displayed as soon as it has been successfully preloaded. If the image load is not successful, or the post does have an associated image, a placeholder image is displayed. Whenever data is being loaded from the network, a transparent animated loading image is rendered over top of the image.

This app may appear simple, but implementations could suffer from any of the following race conditions:

* In the event requests for a sub's posts complete out of order, images from old subs may be displayed after images from subs selected by the user more recently.
* In the event image preloads complete out of order, old images may be displayed after images selected by the user more recently.
* While a new sub is being loaded, the UI may continue responding to the navigation events for the current sub. Consequently images from the old sub may be displayed briefly before abruptly being replaced by those in the newly-loaded sub.

Note that all of these race conditions have one thing in common: they can be avoided by unsubscribing from a pending network request or an event type when an event is received. In the following subsections, two solutions will be contrasted:

1. Coordinating concurrency using shared mutable state
2. Coordinating concurrency compositionally using EventTargetObservable and a library 

#### Solution: Coordinate Concurrency using Shared Mutable State

Consider the following solution, which coordinates concurrent subscriptions to both EventTargets and Promises using shared mutable state.

```js
const subSelect = document.querySelector('#subSelect');
const displayedImage = document.querySelector("#displayedImage");
const titleLabel = document.querySelector("#titleLabel");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");

// shared mutable state used to track the currently displayed image
let index;

// shared mutable state used to coordinate concurrency
let posts;
let currentOperationToken = {};

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
  currentOperationToken = {};
  let thisOperationToken = currentOperationToken;
  
  return preloadImage(summary.image).
    then(
      () => {
        // noop if this is no longer the current operation
        if (thisOperationToken === currentOperationToken) {
          titleLabel.innerText = summary.title
          displayedImage.src = detail.image || "./noimagefound.gif"
        }
      },
      e => {
        // noop if this is no longer the current operation
        if (thisOperationToken === currentOperationToken) {
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
  
  currentOperationToken = {};
  let thisOperationToken = currentOperationToken;
  newsAggregator.
      getSubPosts(sub).
      then(
        postsResponse => {
          if (thisOperationToken === currentOperationToken) {
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

In the example solution above race conditions are avoided by using shared mutable state to track the current operation, and explicit guards are used to avoid responding to outdated operations.

```js
if (posts == null) {
  return;
}

// ...snip...

if (thisOperationToken === currentOperationToken) {
  // ...snip...
}
```

Failure to explicitly include these guards can lead to race conditions which calls notifications to be processed out of order. Furthermore the inability to unsubscribe from Promises means that these guards must be explicitly inserted in both the resolve and reject callbacks.

Yet more shared mutable state is necessary because EventTarget and Promise do not compose. Note that in order to make the values resolved by `Promises` available to `EventTarget` handlers, it is necessary to write them to the shared mutable `posts` variable.

#### Alternate Solution: ObservableEventTarget and a small combinator library

Canceling or ignoring the output of a concurrent operation when a new event is received is one of the most common concurrency coordination patterns used in web applications. This common coordination pattern can be encapsulated in a single Observable method: `switchLatest`.

The `switchLatest` combinator transforms a multi-dimensional Observable into an Observable flattened by one dimension. As soon the outer Observable notifies an inner Observable, `switchLatest` unsubscribes from the currently-subscribed inner Observable and subscribes to the most recently notified inner Observable.

The behavior of the `switchLatest` function can be understood more easily through the use of a textual representation. Consider the following textual representation of an Observable:

```<|,,,1,,,,,5,,,,,,,9,,,,|>```

In the representation above each ```<|``` is the point at which the Observable is subscribed, and each ```|>``` indicates a `complete` notification. Furthermore each `,` represents 10 milliseconds and each number represents a `next` notification to the Observer. 

A program in which a network request is sent for each event in an event stream can be modeled as a two-dimensional Observable...

```
<|
,,,,,<|,,,,,,,,,,,,,,,,,,,,,,88,,,,|>
,,,,,,,,,<|,,,,,33,,,,,,,,,,,,,|>
,,,,,,,,,,,,,,,,,,,,,<|,,,,,,,,,9|>
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|>
```

If the `switchLatest` function is applied to flatten the two-dimensional Observable above, the following result is produced.

`<|,,,,,,,,,,,,,,,,33,,,,,,,,,,,9,,,,,,,|>`

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

Note that the resulting code is shorter than the correct previous solution. More importantly the code contains does not utilize any shared mutable state for concurrency coordination.

## More Compositional Web Applications with ObservableEventTarget

The web platform has much to gain by including a primitive which can allow EventTargets and Promises to be composed. This proposal, along with the Observable proposal currently being considered by the TC-39, are incremental steps towards a more compositional approach to concurrency coordination. If the Observable proposal is accepted, the Observable prototype will have the opportunity to be enriched with useful combinators over time, eliminating the need for a combinator library in common cases.
