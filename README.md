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
let unsubscribe = commandKeys(inputElement).subscribe({
    next(val) { console.log("Recieved key command: " + val) },
    error(err) { console.log("Recieved an error: " + err) },
    complete() { console.log("Stream complete") },
});
```

The function returned by **subscribe** will allow us to cancel the subscription at any time.
Upon cancelation, the Observable's cleanup function will be executed.

```js
// After calling this function, no more events will be sent
unsubscribe();
```

### API ###

#### Observable ####

```js
interface Observable {

    constructor(subscriber : Function);

    // Subscribes to the sequence
    subscribe(observer : Observer) : Function;

    // Standard combinators
    filter(callback : Function) : Observable;
    map(callback : Function) : Observable;

    // Returns itself
    get [Symbol.observable]() : Observable;

    // Converts items to an Observable
    static of(...items: [any]) : Observable;

    // Converts an observable or iterable to an Observable
    static from(observable: any) : Observable;

    // Subclassing support
    static get [Symbol.species]() : Function;

}
```

#### Observer ####

```js
interface Observer {

    // Recieves the next value in the sequence
    next(value : any);

    // Recieves the sequence error
    error(errorValue : any);

    // Receives the sequence completion value
    complete(completeValue: any);
}
```

#### SubscriptionObserver ####

```js
interface SubscriptionObserver {

    // Returns true if the subscription is closed
    get closed() : Boolean;

    // Sends the next value in the sequence
    next(value : any);

    // Sends the sequence error
    error(errorValue : any);

    // Sends the sequence completion value
    complete(completeValue: any);
}
```

### Core API Specification ###

*This specification is a work-in-progress.  Please see the [polyfill](src/Observable.js)
for a more complete implementation.*

#### Observable(subscriber) ###

The **Observable** constructor initializes a new Observable object.  It is not
intended to be called as a function and will throw an exception when called in
that manner.

The *subscriber* argument must be a function object.  It is called each time the
*subscribe* method of the Observable object is invoked.  The *subscriber* function is
called with a wrapped observer object and may optionally return a function which will
cancel the subscription, or an object which has an "unsubscribe" method.

The **Observable** constructor performs the following steps:

1. If **NewTarget** is undefined, throw a **TypeError** exception.
1. If IsCallable(*subscriber*) is **false**, throw a **TypeError** exception.
1. Let *observable* be OrdinaryCreateFromConstructor(**NewTarget**,
   **"%ObservablePrototype%"**, «‍[[Subscriber]]» ).
1. ReturnIfAbrupt(**observable**).
1. Set *observable's* [[Subscriber]] internal slot to *subscriber*.
1. Return *observable*.

#### get Observable[@@species] ###

**Observable[@@species]** is an accessor property whose set accessor function is
**undefined**. Its get accessor function performs the following steps:

1. Return the **this** value.

#### Observable.prototype.subscribe(observer) ####

The **subscribe** function begins sending values to the supplied *observer* object
by executing the Observable object's subscriber function.  It returns a function
object which may be used to cancel the subscription.

The **subscribe** function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have an [[Subscriber]] internal slot, throw a **TypeError**
   exception.
1. If Type(*observer*) is not Object, throw a **TypeError** exception.
1. Let *observer* be CreateSubscriptionObserver(*observer*).
1. ReturnIfAbrupt(*observer*).
1. Let *subscriber* be the value of *O's* [[Subscriber]] internal slot.
1. Assert: IsCallable(*subscriber*) is **true**.
1. Let *subscriberResult* be ExecuteSubscriber(*subscriber*, *observer*).
1. If *subscriberResult* is an abrupt completion,
    1. Let *errorResult* be Invoke(*subscriptionObserver*, **"error""**,
       «‍*subscriberResult*.[[value]]»).
    1. ReturnIfAbrupt(*errorResult*).
1. Else, set the [[Cleanup]] internal slot of *observer* to *subscriberResult*.[[value]].
1. If SubscriptionClosed(*observer*) is **true**,
    1. Let *cancelResult* be CancelSubscription(*observer*).
    1. ReturnIfAbrupt(*cancelResult*).
1. Let *cancelFunction* be a new built-in function object as defined in Subscription Cancel
   Functions.
1. Set the [[SubscriptionObserver]] internal slot of *cancelFunction* to *observer*.
1. Return *cancelFunction*.

#### ExecuteSubscriber(subscriber, observer) ####

The abstract operation ExecuteSubscriber with arguments *subscriber* and *observer*
performs the following steps:

1. Assert: IsCallable(*subscriber*) is **true**.
1. Assert: Type(*observer*) is Object.
1. Let *subscriberResult* be Call(*subscriber*, **undefined**, *observer*).
1. ReturnIfAbrupt(*subscriberResult*).
1. If *subscriberResult* is **null** or **undefined**, return **undefined**.
1. If IsCallable(*subscriberResult*) is **false**, throw a **TypeError** exception.
1. Return *subscriberResult*.

#### Subscription Cancel Functions ####

A subscription cancel function is an anonymous built-in function that has a
[[SubscriptionObserver]] internal slot.

When a subscription cancel function *F* is called the following steps are taken:

1. Assert: *F* as a [[SubscriptionObserver]] internal slot whose value is an Object.
1. Let *subscriptionObserver* be the value of the [[SubscriptionObserver]] internal
   slot of *F*.
1. Return CancelSubscription(*subscriptionObserver*).

The **length** property of a subscription cancel function is **0**.

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

#### CreateSubscriptionObserver(observer) Abstract Operation ####

The abstract operation CreateSubscriptionObserver with argument *observer* is used to
create a normalized observer which can be supplied to an observable's *subscriber*
function.  It performs the following steps:

1. Assert: Type(*observer*) is Object.
1. Let *subscriptionObserver* be ObjectCreate(%SubscriptionObserverPrototype%,
   «‍[[Observer]], [[Cleanup]], [[Cancel]]»).
1. Set *subscriptionObserver's* [[Observer]] internal slot to *observer*.
1. Set *subscriptionObserver's* [[Cleanup]] internal slot to **undefined**.
1. Return *subscriptionObserver*.

#### CancelSubscription(subscriptionObserver) Abstract Operation ####

The abstract operation CancelSubscription with argument *subscriptionObserver* performs the
following steps:

1. Assert: *subscriptionObserver* is a Subscription Observer object.
1. Assert: The value of the [[Observer]] internal slot of *subscriptionObserver* is not **undefined**.
1. Set the value of the [[Observer]] internal slot of *subscriptionObserver* to **undefined**.
1. Return CleanupSubscription(*subscriptionObserver*).

#### CleanupSubscription(subscriptionObserver) Abstract Operation ####

The abstract operation CleanupSubscription with argument *subscriptionObserver* performs the
following steps:

1. Assert: *subscriptionObserver* is a Subscription Observer object.
1. Let *cleanup* be the value of the [[Cleanup]] internal slot of *subscriptionObserver*.
1. If *cleanup* is **undefined**, return **undefined**.
1. Assert: IsCallable(*cleanup*) is **true**.
1. Set the value of the [[Cleanup]] internal slot of *subscriptionObserver* to **undefined**.
1. Let *result* be Call(*cleanup*, **undefined**, «‍»).
1. ReturnIfAbrupt(*result*).
1. Return **undefined**.

#### SubscriptionClosed(subscriptionObserver) Abstract Operation ####

The abstract operation SubscriptionClosed with argument *subscriptionObserver* performs the
following steps:

1. Assert: *subscriptionObserver* is a Subscription Observer object.
1. If the value of the [[Observer]] internal slot of *subscriptionObserver* is **undefined**,
   return **true**.
1. Else, return **false**.

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
1. If SubscriptionClosed(*O*) is **true**, return **undefined**.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. Assert: Type(*observer*) is Object.
1. Let *result* be GetMethod(*observer*, **"next"**).
1. If *result*.[[type]] is **normal**,
    1. Let *nextMethod* be *result*.[[value]].
    1. If *nextMethod* is **undefined**, let *result* be NormalCompletion(**undefined**).
    1. Else, let *result* be Call(*nextMethod*, *observer*, «‍*value*»).
1. If *result* is an abrupt completion,
    1. Let *cancelResult* be CancelSubscription(*O*).
    1. ReturnIfAbrupt(*cancelResult*).
1. Return Completion(*result*).

#### %SubscriptionObserverPrototype%.error(exception) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. If SubscriptionClosed(*O*) is **true**, return Completion{[[type]]: **throw**,
   [[value]]: *exception*, [[target]]: **empty**}.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. Assert: Type(*observer*) is Object.
1. Set the value of the [[Observer]] internal slot of *O* to **undefined**.
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
1. If SubscriptionClosed(*O*) is **true**, return **undefined**.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. Assert: Type(*observer*) is Object.
1. Set the value of the [[Observer]] internal slot of *O* to **undefined**.
1. Let *result* be GetMethod(*observer*, **"complete"**).
1. If *result*.[[type]] is **normal**,
    1. Let *completeMethod* be *result*.[[value]].
    1. If *completeMethod* is **undefined**, let *result* be NormalCompletion(**undefined**).
    1. Else, let *result* be Call(*completeMethod*, *observer*, «*‍value*»).
1. Let *cleanupResult* be CleanupSubscription(*O*).
1. ReturnIfAbrupt(*cleanupResult*).
1. Return Completion(*result*).

#### get %SubscriptionObserverPrototype%.closed ####

%SubscriptionObserverPrototype%.closed is an accessor property whose set accessor function
is undefined. Its get accessor function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Return SubscriptionClosed(*O*).
