Why are error and completion notifications useful in Event Streams?
======

Observables have a well-defined way of notifying that a stream of data has ended, either due to error or completion. These notifications are sent by either resolving or rejecting the Promise returned from `forEach`:

```js
let promise = someObservable.forEach(value => process(value));
promise.then(
  result => console.log(“Final value:”, result),
  error => console.error(“Oh no!:”, error));
```

This contrasts with both EventTarget (ET) and EventEmitter (EE), neither of which has a well-defined way of notifying that the stream has ended due to completion or error. It's reasonable to question the value of these notifications given that they are not present in either EE or ET, arguably the two most common push stream APIs used in JavaScript. 

This document attempts to justify the value of completion and error notifications by demonstrating that they enable useful composition operations. These composition operations in turn allow for a wider range of async programming patterns to be expressed within asynchronous functions. This improves developer ergonomics because using async functions offer developers a host of benefits including...

* Avoiding memory leaks caused by failure to release callbacks
* Automatically propagating errors
* The ability to use JavaScript control flow primitives (for/while/try)

Enabling Event Stream Composition with Completion notifications
------

On the web it is common to build workflows in which events in an event stream are processed until an event is received from another event stream. Here are some examples:

* Listening for events from a DOM element until another event occurs which causes the element to be unmounted
* Drawing a signature on a canvas by listening to a mouse move until a mouse up move is received
* Dragging elements in a user-interface across the screen
* Recognizing complex touch gestures

Listening to an event stream until an event is received from another event stream can be cumbersome using either EE or ET. Neither API returns Promises, which makes it difficult to coordinate their events in async functions. As a consequence developers must often fallback to using callbacks and state machines.

Here’s an example that draws a signature on a canvas until a cancel button is pressed:

```js
function drawSignature(canvas, cancelButton, okButton) {
  const context = signatureCanvas.getContext('2d');
  const toPoint = e => ({ x: e.offsetX, y: e.offsetY });
  let onMouseDown, onMouseMove, onMouseUp, onCancelClick;
  
  onMouseUp = () => {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
  };
  
  onMouseDown = e => {
    let lastPoint = toPoint(e);
    
    onMouseMove = e => {
      let point = toPoint(e);
      strokeLine(context, lastPoint.x, lastPoint.y, point.x, point.y);
      lastPoint = point;
      okButton.disabled = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
  };
  
  onCancelClick = e => {
    onmouseup();
    canvas.removeEventListener('mousedown', onMouseDown);
    cancelButton.removeEventListener('click', onCancelClick);
  };

  canvas.addEventListener('mousedown', onMouseDown);
  cancelButton.addEventListener('click', onCancelClick);
}
```

In addition to the nonlinear nature of the code above, note how easy it is to accidentally omit event unsubscription. Neglecting to unsubscribe from events can cause memory leaks which are difficult to track down and gradually degrade application performance. These leaks are more severe in single-page web applications, because long-running pages are more likely to run out of memory.

### Declarative concurrency in async functions using takeUntil

It’s interesting to note **while most ETs and EEs are infinite, it is possible to build a single *finite* event streams from two or more infinite event streams.** By adding an explicit completion event to Observable we are able to create a very useful composition operation: `takeUntil`. 

The `takeUntil` method operation accepts a “source” Observable, and a "stop" Observable, and concurrently listens to both. The result is a composed Observable that forwards all of the events received from the "source" stream until a notification is received from the "stop" stream. Once a notification is received from the "stop" stream, the composed Observable notifies completion to its Observer, and unsubscribes from both the “source” and “stop” streams.

Here’s the signature code collection above rewritten using Observable and takeUntil:

```js
import { _ } from 'lodash-for-events';

async function drawSignature(signatureCanvas, okButton, token) {
  await.cancelToken = cancelToken;
  const context = signatureCanvas.getContext('2d');
  const toPoint = e => ({ x: e.offsetX, y: e.offsetY });
  const sigMouseDowns =
    _(signatureCanvas.on('mousedown')).map(toPoint);
  const sigMouseMoves =
    _(signatureCanvas.on('mousemove')).map(toPoint);
  const sigMouseUps   = 
    _(signatureCanvas.on('mouseup')).map(toPoint);

  while(true) {
    let lastPoint = await sigMouseDowns.first(token);

    await sigMouseMoves.takeUntil(sigMouseUps).
      forEach(
        point => {
          strokeLine(context, lastPoint.x, lastPoint.y, point.x, point.y);
          okButton.disabled = false;
          lastPoint = point;
        },
        token);
  }
}
```
 
In the example above the takeUntil operation concurrently listens to both event streams internally, and exposes a single (possibly) finite event stream which can be consumed within an async function. The `takeUntil` function also removes the need for developers to explicitly unsubscribe from events, because unsubscription is automatically executed when the stream terminates.

Enabling Observable and Promise composition with Error notifications
-------

In the previous section it was demonstrated that adding a completion notification to Observable allows multiple infinite event streams to be composed into a (possibly) finite event stream. This allows the common concurrency pattern of processing an event until another event occurs to be expressed within an async function.

This section will demonstrate that adding an error notification to Observables enables them to be composed together with Promises to create new event streams. In order to compose Promises and Observables, we must adapt Promises into Observables. In order to ensure that errors from Promise rejections are not swallowed, we must add a corresponding error notification to Observables. If we add an error notification to Observable, Observable’s functions can automatically propagate unhandled errors, just as Promise functions do (ex. `then`). The result is that when new event streams are produced by composing Promises and Observables, errors arising from Promises rejections can be caught using try/else within an async function.

There are many use cases for combining Observables and Promises on the web. One such use case is an auto-complete box which displays searches as the user types. A well-written autocomplete box has the following features:

* debounces keypresses to avoid flooding the server with requests
* ensures that responses are not handled out of order (ie. displaying results for “a” on top of “ab”)
* retries individual requests for a certain number of times, but give up if an individual request fails more than 3 times and tell the user to come back later. This reduces traffic in the event the server is down, and gives it a chance to recover.

In the example below we combine an Observable of keypress events with async requests to create a new stream of search results which are never returned out of order.

```js
import { _ } from 'lodash-for-events';

async function displaySearchResults(input, searchResultsDiv, token) {
  try {
    await _(input.on('keyup')).
      debounce(20).
      map(e => input.value).
      switchMap(query =>
        _.fromPromiseFactory(subToken => search(query, subToken))).
      forEach(
        results => {
          searchResultsDiv.innerHTML = 
            "<ul>" +
              results.
                map(result => `<li>${result}</li>`).
                reduce((html, li) => html + li) +
            "</ul>";
        },
        token);
  }
  else {
    searchResults.innerHTML = "The server is down right now. Come back later and try again.";
  }
}
```

Let’s go over the functions used above one by one:

* debounce. This function debounces an Observable stream given a timespan in milliseconds.
* search. This function returns a Promise which will eventually return the search results for a given query. The function will retry 3 times to compensate for intermittent server failures, then reject if another error is encountered.
* switchMap. This function ensures that results are never returned out of order. The function is called *switchMap* because it *maps* each item in the stream into a new asynchronous operation, creating a nested stream of async operations (in this case an `Observable<Observable<Array<String>>>`). Then it flattens the nested stream of async operations into a flat stream of their results by *switching* to the latest async operation whenever it arrives, and unsubscribing from any outstanding async operations if they exist (in this case producing an `Observable<Array<String>>`).
* fromPromiseFactory. This function accepts a factory function which accepts a cancel token and returns a Promise. The result is an Observable which creates a new instance of the Promise for each subscription, and cancels the underlying async operation when the subscription ends.

The Promise returned by `search` rejects after a certain number of retries. If the Promise eventually rejects, `fromPromiseFactory` propagates the error through via the Observable’s error notification. Having a well-defined semantic for sending errors ensures each subsequent function (ex. `switchMap`, `forEach`) can automatically forward the error, just as Promise functions automatically forward rejection errors. As a result, the developer can use the familiar try/catch mechanism to handle errors that arise from a Promise which has been composed together with an event stream.

Observable's error and completion notifications improve the expressiveness of async functions
------

While an individual EE’s or ET’s are typically infinite streams, the examples above demonstrate that adding both completion and error notifications to Observable enables new types of composition operations. These composition operations enable both event streams and Promises to be combined together declaratively. The benefit of this approach is that more async programming patterns can be expressed using simple JavaScript control flow primitives within async functions.
