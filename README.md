## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- *Compositional*: Observables can be composed with higher-order combinators.
- *Lazy*: Observables do not start emitting data until an **observer** has subscribed.
- *Integrated with ES6*: Data is sent to consumers using the ES6 generator interface.

> The **Observable** concept comes from *reactive programming*.  See http://reactivex.io/
> for more information.

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

*This specification is a work-in-progress.  Please see the [polyfill](src/Observable.js)
for a more complete implementation.*

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

The *subscribe* function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have an [[Executor]] internal slot, throw a **TypeError**
   exception.
1. If Type(*observer*) is not Object, throw a **TypeError** exception.
1. Let *subscription* be a new ObservableSubscription { [[Done]]: **false**, [[Cancel]]:
   **null** }.
1. Let *subscriptionObserver* be CreateSubscriptionObserver(*observer*, *subscription*).
1. ReturnIfAbrupt(*subscriptionObserver*).
1. Let *executor* be the value of *O's* [[Executor]] internal slot.
1. Let *executorResult* be Call(*executor*, **undefined**, *subscriptionObserver*).
1. Let *executorResult* be GetObservableCancelFunction(*executorResult*,
   *subscriptionObserver*).
1. If *executorResult* is an abrupt completion,
    1. Let *throwResult* be Invoke(*subscriptionObserver*, **"throw""**,
       «‍*result*.[[value]]»).
    1. ReturnIfAbrupt(*throwResult*).
1. Else, set *subscription*.[[Cancel]] to *executorResult*.[[value]].
1. If *subscription*.[[Done]] is **true**,
    1. Let *cancelResult* be CancelSubscription(*subscription*).
    1. ReturnIfAbrupt(*cancelResult*).
1. Let *unsubscribeFunction* be a new built-in anonymous function which performs the
   following steps:
    1. Return Invoke(*subscriptionObserver*, **"return"**, «»).
1. Return *unsubscribeFunction*.

#### GetObservableCancelFunction(executorResult, observer) Abstract Operation ####

The abstract operation GetObservableCancelFunction with arguments *executorResult*
and *observer* performs the following steps:

1. If *executorResult* is an abrupt completion, return *executorResult*.
1. Let *cancelFunction* be *executorResult*.[[value]].
1. If *cancelFunction* is **null** or **undefined**, let *cancelFunction* be a new
   built-in anonymous function that performs the following steps:
    1. Return Invoke(*observer*, **"return"**, «»).
1. Else, if IsCallable(*cancelFunction*) is **false**, throw a **TypeError** exception.
1. Return Completion(*executorResult*).

#### Observable.prototype.forEach(callbackfn [, thisArg]) ###

The **forEach** function subscribes to the Observable object, calling *callbackfn*
once for each value in the sequence.  It returns a Promise object which is either
fulfilled with the return value of the sequence or rejected with the error value of
the sequence.

The *forEach* function performs the following steps:

1. Let *O* be ToObject(**this** value).
1. ReturnIfAbrupt(*O*).
1. If IsCallable(*callbackfn*) is **false**, throw a **TypeError** exception.
1. If *thisArg* was supplied, let *T* be *thisArg*; else let *T* be **undefined**.
1. Let *observerNext* be a new built-in anonymous function which performs the following
   steps when called with argument *value*:
   1. Return Call(*callbackfn*, *T*, «‍value»).
1. ReturnIfAbrupt(*observerNext*).
1. Let *promiseCapability* be NewPromiseCapability(%Promise%).
1. ReturnIfAbrupt(*promiseCapability*).
1. Let *observer* be ObjectCreate(%ObjectPrototype%).
1. Perform CreateDataProperty(*observer*, **"next"**, *observerNext*).
1. Perform CreateDataProperty(*observer*, **"throw"**, *promiseCapability*.[[Reject]]).
1. Perform CreateDataProperty(*observer*, **"return"**, *promiseCapability*.[[Resolve]]).
1. Let *result* be Invoke(*O*, **"subscribe"**, «‍*observer*»).
1. IfAbruptRejectPromise(*result*, *promiseCapability*).
1. Return *promiseCapability*.[[Promise]].

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

#### CreateSubscriptionObserver(observer, subscription) Abstract Operation ####

The abstract operation CreateSubscriptionObserver with arguments *observer* and
*subscription* is used to create a normalized observer which can be supplied the
an observable's *executor* function.  It performs the following steps:

1. Assert: Type(*observer*) is Object.
1. Assert: *subscription* is a ObservableSubscription Record.
1. Let *subscriptionObserver* be ObjectCreate(%SubscriptionObserverPrototype%,
   «‍[[Observer]], [[Subscription]]»).
1. Set *subscriptionObserver's* [[Observer]] internal slot to *observer*.
1. Set *subscriptionObserver's* [[Subscription]] internal slot to *subscription*.
1. Return *subscriptionObserver*.

#### CloseSubscription(subscription) Abstract Operation ####

The abstract operation CloseSubscription with argument *subscription* performs the
following steps:

1. Assert: *subscription*.[[Done]] is **false**.
1. Set *subscription*.[[Done]] to **true**.
1. Return CancelSubscription(*subscription*).

#### CancelSubscription(subscription) Abstract Operation ####

The abstract operation CancelSubscription with argument *subscription* performs the
following steps:

1. Let *cancel* be *subscription*.[[Cancel]].
1. If *cancel* is **null**, return **undefined**.
1. Assert: IsCallable(*cancel*) is **true**.
1. Set *subscription*.[[Cancel]] to **null**.
1. Let *result* be Call(*cancel*, **undefined**).
1. ReturnIfAbrupt(*result*).
1. Return **undefined**.

#### The %SubscriptionObserverPrototype% Object ####

All Subscription Observer objects inherit properties from the %SubscriptionObserverPrototype%
intrinsic object.  The %SubscriptionObserverPrototype% object is an ordinary object and its
[[Prototype]] internal slot is the %ObjectPrototype% intrinsic object. In addition,
%SubscriptionObserverPrototype% has the following properties:

#### %SubscriptionObserverPrototype%.next(value) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer Instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *subscription*.[[Done]] is **true**, return CreateIterResultObject(**undefined**,
   **true**).
1. Let *result* be Invoke(*observer*, **"next"**, «‍value»).
1. Let *closeSubscription* be **false**.
1. If *result* is an abrupt completion,
    1. Let *closeSubscription* be **true**.
1. Else, if Type(*result*.[[value]]) is Object,
    1. Let *closeSubscription* be IteratorComplete(*result*.[[value]]).
1. If *closeSubscription* is **true**,
    1. Let *closeResult* be CloseSubscription(*subscription*).
    1. ReturnIfAbrupt(*closeResult*).
1. Return Completion(*result*).

#### %SubscriptionObserverPrototype%.throw(exception) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer Instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *subscription*.[[Done]] is **true**, return Completion{[[type]]: **throw**,
   [[value]]: *exception*, [[target]]: **empty**}.
1. Set *subscription*.[[Done]] to **true**.
1. Let *result* be Get(*observer*, **"throw"**).
1. If *result*.[[type]] is **normal**,
    1. Let *throwAction* be *result*.[[value]].
    1. If IsCallable(*throwAction*) is **true**,
        1. Let *result* be Call(*throwAction*, *observer*, «‍exception»).
    1. Else,
        1. Let *result* be Completion{[[type]]: **throw**, [[value]]: *exception*,
           [[target]]: **empty**}.
1. Let *cancelResult* be CancelSubscription(*subscription*).
1. ReturnIfAbrupt(*cancelResult*).
1. Return Completion(*result*).

#### %SubscriptionObserverPrototype%.return(value) ####

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If *O* does not have all of the internal slots of a Subscription Observer Instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *subscription*.[[Done]] is **true**, return CreateIterResultObject(**undefined**,
   **true**).
1. Set *subscription*.[[Done]] to **true**.
1. Let *result* be Get(*observer*, **"return"**).
1. If *result*.[[type]] is **normal**,
    1. Let *returnAction* be *result*.[[value]].
    1. If IsCallable(*returnAction*) is **true**,
        1. Let *result* be Call(*returnAction*, *observer*, «‍value»).
    1. Else,
        1. Let *result* be NormalCompletion(CreateIterResultObject(**undefined**,
           **true**)).
1. Let *cancelResult* be CancelSubscription(*subscription*).
1. ReturnIfAbrupt(*cancelResult*).
1. Return Completion(*result*).

#### ObservableSubscription Records ####

The ObservableSubscription is a Record value used to store the current subscription
state and the cancellation function provided by an observable.

ObservableSubscription records have the following fields:

- [[Done]] *Boolean*:  Initially **false**, set to **true** if the subscription has been
  terminated by the observer indicating completion or by the observable calling
  **throw** or **return** on its observer.
- [[Cancel]] *a function object or null*: A function provided by the observable
  which will terminate the subscription.
