## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- Compositional: Observables can be composed with higher-order combinators.
- Lazy: Observables do not start emitting data until an **observer** is subscribed.
- Integrated with ES6: Data is sent to consumers using the ES6 generator interface.

The **Observable** concept comes from *reactive programming*.  See http://reactivex.io/
for more information.

### Example: Observing Keyboard Events ###

Using the **Observable** constructor, we can create a function which returns an
observable stream of events for an arbitrary DOM element and event type.

```js
function listen(element, eventName) {
    return new Observable(sink => {
        // Create an event handler which sends data to the sink
        let handler = event => sink.next(event);

        // Attach the event handler
        element.addEventListener(eventName, handler, true);

        // Return a function which will cancel the event stream
        return _ => {
            // Detach the event handler from the element
            element.removeEventListener(eventName, handler, true);

            // Terminate the stream
            sink.return();
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

When we want to consume the event stream, we subscribe with an **observer**.

```js
commandKeys(inputElement).subscribe({
    next(value) { console.log("Recieved key command: " + value) },
    throw(error) { console.log("Recieved an error: " + error) },
    return() { console.log("Stream complete") },
});
```

Because observers implement the ES6 **generator** interface, we can use a generator
function to consume the events.

```js
function consumer() {
    let generator = function*() {
        while (true) {
            console.log("Recieved key command: " + (yield));
        }
    }();

    // "Prime" the generator so that it can receive the first value from the producer
    generator.next();
    return generator;
}

commandKeys(inputElement).subscribe(consumer());
```

### API Specification ###

*This specification is a work-in-progress.  Please see [the polyfill](src/Observable.js)
for a more complete implementation in ES6.*

#### Observable(executor) ###

The **Observable** constructor initializes a new Observable object.  It is not
intended to be called as a function and will throw an exception when called in
that manner.

The *executor* argument must be a function object.  It is called each time the
*subscribe* method of the Observable object is invoked.  The *executor* is called
with a wrapped observer object and may optionally return a function which will
cancel the subscription.

The **Observable** constructor performs the following steps:

1. If **NewTarget** is undefined, throw a **TypeError** exception.
1. If IsCallable(*executor*) is **false**, throw a **TypeError** exception.
1. Let *observable* be OrdinaryCreateFromConstructor(**NewTarget**,
   **"%ObservablePrototype%"**, «‍[[ObservableExecutor]]» ).
1. ReturnIfAbrupt(**observable**).
1. Set *observable's* [[ObservableExecutor]] internal slot to *executor*.
1. Return *observable*.

#### get Observable[@@species] ###

**Observable[@@species]** is an accessor property whose set accessor function is
**undefined**. Its get accessor function performs the following steps:

1. Return the **this** value.

#### Observable.prototype.subscribe(observer) ####

The **subscribe** function begins sending values to the supplied *observer* object
by executing the Observable object's *executor* function.  It returns a function
which may be used to cancel the subscription.


#### Observable.prototype.forEach(callbackfn) ###

The **forEach** function subscribes to the Observable object, calling *callbackfn*
once for each value in the sequence.  It returns a Promise object which is either
fulfilled with the return value of the sequence or rejected with the error value of
the sequence.

#### Observable.prototype.filter(callbackfn) ####

TODO

#### Observable.prototype.map(callbackfn) ####

TODO

#### Subscription Observer Objects ####

A Subscription Observer is an object which wraps the *observer* argument supplied to the
*subscribe* method of Observable objects.  Subscription Observer objects are passed as
the single parameter to an observable's *executor* function.  They enforce the following
guarantees:

- If the observer's **next** method returns an iterator result object with a **done**
  property whose value is **true**, then the observer will not be invoked again and the
  observable's cancellation function will be called.
- If the observer's **throw** method is called, then the observer will not be invoked
  again and the observable's cancellation function will be called.
- If the observer's **return** method is called, then the observer will not be invoked
  again and the observable's cancellation function will be called.
- The observable's cancellation function will be called at most one time.

In addition, Subscription Observer objects provide default behaviors when the observer
does not implement **throw** or **return**.

#### CreateSubscriptionObserver Abstract Operation ####

TODO

#### CloseSubscription Abstract Operation ####

TODO

#### CancelSubscription Abstract Operation ####

TODO

#### The %SubscriptionObserverPrototype% Object ####

All Subscription Observer objects inherit properties from the %SubscriptionObserverPrototype%
intrinsic object.  The %SubscriptionObserverPrototype% object is an ordinary object and its
[[Prototype]] internal slot is the %ObjectPrototype% intrinsic object. In addition,
%SubscriptionObserverPrototype% has the following properties:

#### %SubscriptionObserverPrototype%.next(value) ####

TODO

#### %SubscriptionObserverPrototype%.throw(exception) ####

TODO

#### %SubscriptionObserverPrototype%.return(value) ####

TODO
