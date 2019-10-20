## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- *Compositional*: Observables can be composed with higher-order combinators.
- *Lazy*: Observables do not start emitting data until an **observer** has subscribed.

### Example: Observing Keyboard Events ###

Using the **Observable** constructor, we can create a function which returns an
observable stream of events for an arbitrary DOM element and event type.

```js
function listen(element, eventName) {
    return new Observable(observer => {
        // Create an event handler which sends data to the sink
        let handler = event => observer.next(event);

        // Attach the event handler
        element.addEventListener(eventName, handler, true);

        // Return a cleanup function which will cancel the event stream
        return () => {
            // Detach the event handler from the element
            element.removeEventListener(eventName, handler, true);
        };
    });
}
```

We can then use standard combinators to filter and map the events in the stream,
just like we would with an array.

```js
// Return an observable of special key down commands
function commandKeys(element) {
    let keyCommands = { "38": "up", "40": "down" };

    return listen(element, "keydown")
        .filter(event => event.keyCode in keyCommands)
        .map(event => keyCommands[event.keyCode])
}
```

*Note: The "filter" and "map" methods are not included in this proposal.  They may
be added in a future version of this specification.*

When we want to consume the event stream, we subscribe with an **observer**.

```js
let subscription = commandKeys(inputElement).subscribe({
    next(val) { console.log("Received key command: " + val) },
    error(err) { console.log("Received an error: " + err) },
    complete() { console.log("Stream complete") },
});
```

The object returned by **subscribe** will allow us to cancel the subscription at any time.
Upon cancelation, the Observable's cleanup function will be executed.

```js
// After calling this function, no more events will be sent
subscription.unsubscribe();
```

### Motivation ###

The Observable type represents one of the fundamental protocols for processing asynchronous
streams of data.  It is particularly effective at modeling streams of data which originate
from the environment and are pushed into the application, such as user interface events. By
offering Observable as a component of the ECMAScript standard library, we allow platforms
and applications to share a common push-based stream protocol.

### Implementations ###

- [RxJS 5](https://github.com/ReactiveX/RxJS)
- [core-js](https://github.com/zloirock/core-js#observable)
- [zen-observable](https://github.com/zenparsing/zen-observable)
- [fate-observable](https://github.com/shanewholloway/node-fate-observable)

### Running Tests ###

To run the unit tests, install the **es-observable-tests** package into your project.

```
npm install es-observable-tests
```

Then call the exported `runTests` function with the constructor you want to test.

```js
require("es-observable-tests").runTests(MyObservable);
```

### API ###

#### Observable ####

An Observable represents a sequence of values which may be observed.

```js
interface Observable {

    constructor(subscriber : SubscriberFunction);

    // Subscribes to the sequence with an observer
    subscribe(observer : Observer) : Subscription;

    // Subscribes to the sequence with callbacks
    subscribe(onNext : Function,
              onError? : Function,
              onComplete? : Function) : Subscription;

    // Returns itself
    [Symbol.observable]() : Observable;

    // Converts items to an Observable
    static of(...items) : Observable;

    // Converts an observable or iterable to an Observable
    static from(observable) : Observable;

}

interface Subscription {

    // Cancels the subscription
    unsubscribe() : void;

    // A boolean value indicating whether the subscription is closed
    get closed() : Boolean;
}

function SubscriberFunction(observer: SubscriptionObserver) : (void => void)|Subscription;
```

#### Observable.of ####

`Observable.of` creates an Observable of the values provided as arguments.  The values
are delivered synchronously when `subscribe` is called.

```js
Observable.of("red", "green", "blue").subscribe({
    next(color) {
        console.log(color);
    }
});

/*
 > "red"
 > "green"
 > "blue"
*/
```

#### Observable.from ####

`Observable.from` converts its argument to an Observable.

- If the argument has a `Symbol.observable` method, then it returns the result of
  invoking that method.  If the resulting object is not an instance of Observable,
  then it is wrapped in an Observable which will delegate subscription.
- Otherwise, the argument is assumed to be an iterable and the iteration values are
  delivered synchronously when `subscribe` is called.

Converting from an object which supports `Symbol.observable` to an Observable:

```js
Observable.from({
    [Symbol.observable]() {
        return new Observable(observer => {
            setTimeout(() => {
                observer.next("hello");
                observer.next("world");
                observer.complete();
            }, 2000);
        });
    }
}).subscribe({
    next(value) {
        console.log(value);
    }
});

/*
 > "hello"
 > "world"
*/

let observable = new Observable(observer => {});
Observable.from(observable) === observable; // true

```

Converting from an iterable to an Observable:

```js
Observable.from(["mercury", "venus", "earth"]).subscribe({
    next(value) {
        console.log(value);
    }
});

/*
 > "mercury"
 > "venus"
 > "earth"
*/
```

#### Observer ####

An Observer is used to receive data from an Observable, and is supplied as an
argument to **subscribe**.

All methods are optional.

```js
interface Observer {

    // Receives the subscription object when `subscribe` is called
    start(subscription : Subscription);

    // Receives the next value in the sequence
    next(value);

    // Receives the sequence error
    error(errorValue);

    // Receives a completion notification
    complete();
}
```

#### SubscriptionObserver ####

A SubscriptionObserver is a normalized Observer which wraps the observer object supplied to
**subscribe**.

```js
interface SubscriptionObserver {

    // Sends the next value in the sequence
    next(value);

    // Sends the sequence error
    error(errorValue);

    // Sends the completion notification
    complete();

    // A boolean value indicating whether the subscription is closed
    get closed() : Boolean;
}
```
