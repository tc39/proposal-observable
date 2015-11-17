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

        // Return a function which will cancel the event stream
        return _ => {
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

Alternatively, we can subscribe to an Observable with the **forEach** method, which accepts
a single callback and returns a Promise.

```js
commandKeys(inputElement).forEach(val => {
    console.log("Received key command: " + val);
});
```

```js
Observable.of(1, 2, 3, 4, 5)
    .map(n => n * n)
    .filter(n => n > 10)
    .forEach(n => console.log(n))
    .then(_ => console.log("All done!"));
```

### Implementations ###

- [zen-observable](https://github.com/zenparsing/zen-observable)

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

    // Subscribes to the sequence
    subscribe(observer : Observer) : Subscription;

    // Subscribes to the sequence with a callback, returning a promise
    forEach(onNext : any => any) : Promise;

    // Returns itself
    [Symbol.observable]() : Observable;

    // Converts items to an Observable
    static of(...items) : Observable;

    // Converts an observable or iterable to an Observable
    static from(observable) : Observable;

    // Subclassing support
    static get [Symbol.species]() : Constructor;

}

interface Subscription {

    // Cancels the subscription
    unsubscribe() : void;
}

function SubscriberFunction(observer: SubscriptionObserver) : (void => void)|Subscription;
```

#### Observable.of ####

`Observable.of` creates an Observable of the values provided as arguments.  The values
are delivered asynchronously, in a future turn of the event loop.

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
  delivered asynchronously in a future turn of the event loop.

Converting from an object which supports `Symbol.observable` to an Observable:

```js
Observable.from({
    [Symbol.observable]() {
        return new Observable(observer => {
            setTimeout(_=> {
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

An Observer is used to recieve data from an Observable, and is supplied as an
argument to **subscribe**.

All methods are optional.

```js
interface Observer {

    // Called when the subscription is initialized
    start(subscription);

    // Recieves the next value in the sequence
    next(value);

    // Recieves the sequence error
    error(errorValue);

    // Receives the sequence completion value
    complete(completeValue);
}
```

#### SubscriptionObserver ####

A SubscriptionObserver is a normalized Observer which wraps the observer supplied to
**subscribe**.  It also provides a **closed** property which may be used to determine
whether the corresponding subscription has been closed.

```js
interface SubscriptionObserver {

    // Returns true if the subscription is closed
    get closed() : Boolean;

    // Sends the next value in the sequence
    next(value);

    // Sends the sequence error
    error(errorValue);

    // Sends the sequence completion value
    complete(completeValue);
}
```

### Core API Specification ###

#### Observable(subscriber) ###

The **Observable** constructor initializes a new Observable object.  It is not
intended to be called as a function and will throw an exception when called in
that manner.

The *subscriber* argument must be a function object.  It is called each time the
*subscribe* method of the Observable object is invoked.  The *subscriber* function is
called with a wrapped observer object and may optionally return a function which will
cancel the subscription.

The **Observable** constructor performs the following steps:

1. If **NewTarget** is undefined, throw a **TypeError** exception.
1. If IsCallable(*subscriber*) is **false**, throw a **TypeError** exception.
1. Let *observable* be OrdinaryCreateFromConstructor(**NewTarget**,
   **"%ObservablePrototype%"**, «‍[[Subscriber]]» ).
1. ReturnIfAbrupt(**observable**).
1. Set *observable's* [[Subscriber]] internal slot to *subscriber*.
1. Return *observable*.

#### Properties of the Observable Constructor ####

The value of the [[Prototype]] internal slot of the **Observable** constructor is the
intrinsic object %FunctionPrototype%.

Besides the **length** property (whose value is 1), the Observable constructor has the
following properties:

#### get Observable[@@species] ###

**Observable[@@species]** is an accessor property whose set accessor function is
**undefined**. Its get accessor function performs the following steps:

1. Return the **this** value.

#### Observable.prototype ####

The initial value of **Observable.prototype** is the intrinsic object %ObservablePrototype%.

This property has the attributes { [[Writable]]: **false**, [[Enumerable]]: **false**,
[[Configurable]]: **false** }.

#### Properties of the Promise Prototype Object ####

The **Observable** prototype object is the intrinsic object %ObservablePrototype%. The value
of the [[Prototype]] internal slot of the **Observable** prototype object is the intrinsic object
%ObjectPrototype%. The **Observable** prototype object is an ordinary object.

#### Observable.prototype.subscribe(observer) ####

The **subscribe** function begins sending values to the supplied *observer* object
by executing the Observable object's subscriber function.  It returns a Subscription
object which may be used to cancel the subscription.

The **subscribe** function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have an [[Subscriber]] internal slot, throw a **TypeError**
   exception.
1. If Type(*observer*) is not Object, throw a **TypeError** exception.
1. Let *subscription* be CreateSubscription(*observer*).
1. ReturnIfAbrupt(*subscription*).
1. Let *subscriptionObserver* be CreateSubscriptionObserver(*subscription*).
1. ReturnIfAbrupt(*subscriptionObserver*).
1. Let *start* be GetMethod(*observer*, **"start"**).
1. ReturnIfAbrupt(*start*).
1. If *start* is not **undefined**,
    1. Let *result* be Call(*start*, *observer*, «‍*subscription*»).
    1. ReturnIfAbrupt(*result*).
    1. If SubscriptionClosed(*subscription*) is **true**, return *subscription*.
1. Let *subscriber* be the value of *O's* [[Subscriber]] internal slot.
1. Assert: IsCallable(*subscriber*) is **true**.
1. Let *subscriberResult* be ExecuteSubscriber(*subscriber*, *subscriptionObserver*).
1. If *subscriberResult* is an abrupt completion,
    1. Let *errorResult* be Invoke(*subscriptionObserver*, **"error""**,
       «‍*subscriberResult*.[[value]]»).
    1. ReturnIfAbrupt(*errorResult*).
1. Else, set the [[Cleanup]] internal slot of *observer* to *subscriberResult*.[[value]].
1. If SubscriptionClosed(*subscription*) is **true**,
    1. Let *cleanupResult* be CleanupSubscription(*subscription*).
    1. ReturnIfAbrupt(*cleanupResult*).
1. Return *subscription*.

#### ExecuteSubscriber(subscriber, observer) ####

The abstract operation ExecuteSubscriber with arguments *subscriber* and *observer*
performs the following steps:

1. Assert: IsCallable(*subscriber*) is **true**.
1. Assert: Type(*observer*) is Object.
1. Let *subscriberResult* be Call(*subscriber*, **undefined**, *observer*).
1. ReturnIfAbrupt(*subscriberResult*).
1. If *subscriberResult* is **null** or **undefined**, return **undefined**.
1. If IsCallable(*subscriberResult*) is **true**, return *subscriberResult*.
1. TODO: Make sure this throws in all the necessary cases.
1. Let *result* be GetMethod(*subscriberResult*, **"unsubscribe"**).
1. ReturnIfAbrupt(*result*).
1. Let *cleanupFunction* be a new built-in function object as defined in Subscription Cleanup
   Functions.
1. Set the [[Subscription]] internal slot of *cancelFunction* to *subscriberResult*.
1. Return *cancelFunction*.

#### Subscription Cleanup Functions ####

A subscription cleanup function is an anonymous built-in function that has a
[[Subscription]] internal slot.

When a subscription cleanup function *F* is called the following steps are taken:

1. Assert: *F* as a [[Subscription]] internal slot whose value is an Object.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *F*.
1. Return Invoke(*subscription*, **"unsubscribe"**, «‍»).

The **length** property of a subscription cleanup function is **0**.

#### Observable.prototype.forEach(callbackFn) ####

The **forEach** function subscribes to the observable and calls *callbackFn* once
for each element in the sequence.  It returns a Promise for the completion value
of the sequence.

*callbackFn* is called with one argument: the value of the next element in the sequence.

The **forEach** function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. Let *promiseCapability* be NewPromiseCapability(%Promise%).
1. ReturnIfAbrupt(*promiseCapability*).
1. If IsCallable(*callbackFn*) is **false**,
    1. Let *r* be a new **TypeError** exception.
    1. Let *rejectResult* be Call(*promiseCapability*.[[Reject]], *r*).
    1. Return *promiseCapability*.[[Promise]].
1. Let *observer* be ObjectCreate(%ObjectPrototype%).
1. Let *next* be a new built-in function object as defined in Observable.prototype.forEach
   Next Functions.
1. Set the [[CallbackFn]] internal slot of *next* to *callbackFn*.
1. Set the [[Reject]] internal slot of *next* to *promiseCapability*.[[Reject]].
1. Perform CreateDataProperty(*observer*, **"next"**, *next*).
1. Perform CreateDataProperty(*observer*, **"error"**, *promiseCapability*.[[Reject]]).
1. Perform CreateDataProperty(*observer*, **"complete"**, *promiseCapability*.[[Resolve]]).
1. Let *subscribeResult* be Invoke(*O*, **"subscribe"**, «‍*observer*»).
1. IfAbruptRejectPromise(*subscribeResult*, *promiseCapability*).
1. Return *promiseCapability*.[[Promise]].

#### Observable.prototype.forEach Next Functions ####

An Observable.prototype.forEach next function is an anonymous built-in function that
is used to process each element of an observable sequence when *forEach* is invoked.
Each Observable.prototype.forEach next function has [[CallbackFn]] and [[Reject]]
internal slots.

When an Observable.prototype.forEach next function *F* is called with argument *x*,
the following steps are taken:

1. Let *callbackFn* be the value of the [[CallbackFn]] internal slot of *F*.
1. Let *promiseReject* be the value of the [[Reject]] internal slot of *F*.
1. Let *result* be Call(*callbackFn*, **undefined**, «‍*x*»).
1. If *result* is an abrupt completion,
    1. Let *rejectResult* be Call(*promiseReject*, **undefined**, «*result*.[[value]]»).
    1. ReturnIfAbrupt(*rejectResult*).
    1. Return **undefined**.
1. Return Completion(*result*).

#### Observable.prototype.constructor ####

The initial value of **Observable.prototype.constructor** is the intrinsic object %Observable%.

#### Observable.prototype[@@observable]\() ###

The following steps are taken:

1. Return the **this** value.

The value of the **name** property of this function is **"[Symbol.observable]"**.

#### Subscription Objects ####

A Subscription is an object which represents a channel through which an Observable
may send data to an Observer.

#### CreateSubscription(observer) Abstract Operation ####

The abstract operation CreateSubscription with argument *observer* is used to
create a Subscription object.  It performs the following steps:

1. Assert: Type(*observer*) is Object.
1. Let *subscription* be ObjectCreate(%SubscriptionPrototype%, «‍[[Observer]], [[Cleanup]]»).
1. Set *subscription's* [[Observer]] internal slot to *observer*.
1. Set *subscription's* [[Cleanup]] internal slot to **undefined**.
1. Return *subscription*.

#### The %SubscriptionPrototype% Object ####

All Subscription objects inherit properties from the %SubscriptionPrototype% intrinsic
object.  The %SubscriptionPrototype% object is an ordinary object and its [[Prototype]]
internal slot is the %ObjectPrototype% intrinsic object. In addition,
%SubscriptionPrototype% has the following properties:

#### %SubscriptionPrototype%.unsubscribe() ####

1. Let *subscription* be the **this** value.
1. If Type(*subscription*) is not Object, throw a **TypeError** exception.
1. If *subscription* does not have all of the internal slots of a Subscription instance,
   throw a **TypeError** exception.
1. If SubscriptionClosed(*subscription*) is **true**, return **undefined**.
1. Set the value of the [[Observer]] internal slot of *subscription* to **undefined**.
1. Return CleanupSubscription(*subscription*).

#### CleanupSubscription(subscription) Abstract Operation ####

The abstract operation CleanupSubscription with argument *subscription* performs the
following steps:

1. Assert: *subscription* is a Subscription object.
1. Let *cleanup* be the value of the [[Cleanup]] internal slot of *subscription*.
1. If *cleanup* is **undefined**, return **undefined**.
1. Assert: IsCallable(*cleanup*) is **true**.
1. Set the value of the [[Cleanup]] internal slot of *subscription* to **undefined**.
1. Let *result* be Call(*cleanup*, **undefined**, «‍»).
1. ReturnIfAbrupt(*result*).
1. Return **undefined**.

#### SubscriptionClosed(subscription) Abstract Operation ####

The abstract operation SubscriptionClosed with argument *subscription* performs the
following steps:

1. Assert: *subscription* is a Subscription object.
1. If the value of the [[Observer]] internal slot of *subscription* is **undefined**,
   return **true**.
1. Else, return **false**.

#### Subscription Observer Objects ####

A Subscription Observer is an object which wraps the *observer* argument supplied to the
*subscribe* method of Observable objects.  Subscription Observer objects are passed as
the single parameter to an observable's *subscriber* function.  They enforce the following
guarantees:

- If the observer's **error** method is called, the observer will not be invoked
  again and the observable's cleanup function will be called.
- If the observer's **complete** method is called, the observer will not be invoked
  again and the observable's cleanup function will be called.
- If the observer throws an exception, the observable's cleanup function will be
  called.
- When the subscription is canceled, the observer will not be invoked again.

In addition, Subscription Observer objects provide default behaviors when the observer
does not implement **next**, **error** or **complete**.

#### CreateSubscriptionObserver(subscription) Abstract Operation ####

The abstract operation CreateSubscriptionObserver with argument *observer* is used to
create a normalized observer which can be supplied to an observable's *subscriber*
function.  It performs the following steps:

1. Assert: Type(*observer*) is Object.
1. Let *subscriptionObserver* be ObjectCreate(%SubscriptionObserverPrototype%,
   «‍[[Subscription]]»).
1. Set *subscriptionObserver's* [[Subscription]] internal slot to *subscription*.
1. Return *subscriptionObserver*.

#### The %SubscriptionObserverPrototype% Object ####

All Subscription Observer objects inherit properties from the %SubscriptionObserverPrototype%
intrinsic object.  The %SubscriptionObserverPrototype% object is an ordinary object and its
[[Prototype]] internal slot is the %ObjectPrototype% intrinsic object. In addition,
%SubscriptionObserverPrototype% has the following properties:

#### %SubscriptionObserverPrototype%.next(value) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. If SubscriptionClosed(*subscription*) is **true**, return **undefined**.
1. Let *observer* be the value of the [[Observer]] internal slot of *subscription*.
1. Assert: Type(*observer*) is Object.
1. Let *result* be GetMethod(*observer*, **"next"**).
1. If *result*.[[type]] is **normal**,
    1. Let *nextMethod* be *result*.[[value]].
    1. If *nextMethod* is **undefined**, let *result* be NormalCompletion(**undefined**).
    1. Else, let *result* be Call(*nextMethod*, *observer*, «‍*value*»).
1. If *result* is an abrupt completion,
    1. Let *closeResult* be CloseSubscription(*subscription*).
    1. ReturnIfAbrupt(*closeResult*).
1. Return Completion(*result*).

#### %SubscriptionObserverPrototype%.error(exception) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. If SubscriptionClosed(*subscription*) is **true**, return Completion{[[type]]: **throw**,
   [[value]]: *exception*, [[target]]: **empty**}.
1. Let *observer* be the value of the [[Observer]] internal slot of *subscription*.
1. Assert: Type(*observer*) is Object.
1. Set the value of the [[Observer]] internal slot of *subscription* to **undefined**.
1. Let *result* be GetMethod(*observer*, **"error"**).
1. If *result*.[[type]] is **normal**,
    1. Let *errorMethod* be *result*.[[value]].
    1. If *errorMethod* is **undefined**, let *result* be Completion{[[type]]: **throw**,
       [[value]]: *exception*, [[target]]: **empty**}.
    1. Else, let *result* be Call(*errorMethod*, *observer*, «‍*value*»).
1. Let *cleanupResult* be CleanupSubscription(*O*).
1. ReturnIfAbrupt(*cleanupResult*).
1. Return Completion(*result*).

#### %SubscriptionObserverPrototype%.complete(value) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. If SubscriptionClosed(*subscription*) is **true**, return **undefined**.
1. Let *observer* be the value of the [[Observer]] internal slot of *subscription*.
1. Assert: Type(*observer*) is Object.
1. Set the value of the [[Observer]] internal slot of *subscription* to **undefined**.
1. Let *result* be GetMethod(*observer*, **"complete"**).
1. If *result*.[[type]] is **normal**,
    1. Let *completeMethod* be *result*.[[value]].
    1. If *completeMethod* is **undefined**, let *result* be NormalCompletion(**undefined**).
    1. Else, let *result* be Call(*completeMethod*, *observer*, «*‍value*»).
1. Let *cleanupResult* be CleanupSubscription(*O*).
1. ReturnIfAbrupt(*cleanupResult*).
1. Return Completion(*result*).
