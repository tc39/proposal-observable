## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- *Compositional*: Observables can be composed with higher-order combinators.
- *Lazy*: Observables do not start emitting data until an **observer** has subscribed.

> The **Observable** concept comes from *reactive programming*.  See http://reactivex.io/
> for more information.

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
commandKeys(inputElement).subscribe({
    next(val) { console.log("Recieved key command: " + val) },
    error(err) { console.log("Recieved an error: " + err) },
    complete() { console.log("Stream complete") },
});
```

### API Specification ###

*This specification is a work-in-progress.  Please see the [polyfill](src/Observable.js)
for a more complete implementation.*

- [Observable Constructor](#observablesubscriber)
- [Observable.prototype.subscribe](#observableprototypesubscribeobserver)
- [Observable.prototype.forEach](#observableprototypeforeachcallbackfn--thisarg)

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

#### Observable.prototype.subscribe(observer) ####

The **subscribe** function schedules a subscription job to begin sending values to the
supplied *observer* object.  It returns a subscription object which may be used to cancel the
subscription.

The **subscribe** function performs the following steps:

1. Let *O* be the **this** value.
1. If Type(*O*) is not Object, throw a **TypeError** exception.
1. If Type(*observer*) is not Object, throw a **TypeError** exception.
1. Let *unsubscribed* be **false**.
1. Let *innerSubscription* be **undefined**.
1. Let *startSubscription* be a new built-in anonymous function which performs the
   following steps:
    1. If *unsubscribed* is **false**,
        1. Let *subscribeResult* be Invoke(*O*, **@@observer**, «‍*observer*»).
        1. ReturnIfAbrupt(*subscribeResult*).
        1. Let *innerSubscription* be *subscribeResult*.
    1. Return **undefined**.
1. Perform EnqueueJob(**"SubscriptionJobs"**, ObservableSubscribeJobs, «*‍startSubscription*»).
1. Let *unsubscribe* be a new built-in anonymous function which performs the following
   steps:
    1. If *unsubscribed* is **true**, return **undefined**.
    1. Let *unsubscribed* be **true**.
    1. If *innerSubscription* is not **undefined**,
        1. If Type(*innerSubscription*) is not Object, throw a **TypeError** exception.
        1. Let *unsubscribeResult* be Invoke(*innerSubscription*, **"unsubscribe"**, «»).
        1. ReturnIfAbrupt(*unsubscribeResult*).
        1. Return **undefined**.
1. Let *subscription* be ObjectCreate(%ObjectPrototype%).
1. Perform CreateDataProperty(*subscription*, **"unsubscribe"**, *unsubscribe*).
1. Return *subscription*.

#### Observable.prototype\[@@observer](observer) ####

The **@@observer** function begins sending values to the supplied *observer* object
by executing the Observable object's *subscriber* function.  It returns a subscription
object which may be used to cancel the subscription.

The **@@observer** function is intended to be used by observable libraries that
need to subscribe to an observable without deferring execution to the subscription job
queue.

The **@@observer** function performs the following steps:

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
    1. Let *throwResult* be Invoke(*subscriptionObserver*, **"throw""**,
       «‍*subscriberResult*.[[value]]»).
    1. ReturnIfAbrupt(*throwResult*).
1. Else, set the [[Subscription]] internal slot of *observer* to *subscriberResult*.[[value]].
1. If the value of the [[Observer]] internal slot of *observer* is **undefined**,
    1. Let *cancelResult* be CancelSubscription(*observer*).
    1. ReturnIfAbrupt(*cancelResult*).
1. Return *subscription*.

#### ExecuteSubscriber(subscriber, observer) ####

The abstract operation ExecuteSubscriber with arguments *subscriber* and *observer*
performs the following steps:

1. Assert: IsCallable(*subscriber*) is **true**.
1. Assert: Type(*observer*) is Object.
1. Let *subscriberResult* be Call(*subscriber*, **undefined**, *observer*).
1. ReturnIfAbrupt(*subscriberResult*).
1. Let *isSubscription* be HasUnsubscribe(*subscriptionResult*).
1. ReturnIfAbrupt(*isSubscription*).
1. If *isSubscription* is **true**, let *subscription* be *subscriberResult*.
1. Else, if IsCallable(*subscriberResult*) is **true**, let *subscription* be
   CreateSubscription(*subscriberResult*).
1. Else,
    1. Let *unsubscribe* be a new built-in anonymous function that performs the following steps:
        1. Let *result* be Invoke(*observer*, **"return"**, «»).
        1. ReturnIfAbrupt(*result*).
        1. Return **undefined**.
    1. Let *subscriber* be CreateSubscription(*unsubscribe*).
1. Return *subscription*.

#### HasUnsubscribe(x) Abstract Operation ####

The abstract operation HasUnsubscribe with argument *x* performs the following steps:

1. If Type(*x*) is not Object, return **false**.
1. Let *unsubscribe* be Get(*x*, **"unsubscribe"**).
1. ReturnIfAbrupt(*unsubscribe*).
1. Return IsCallable(*unsubscribe*).

#### CreateSubscription(unsubscribe) Abstract Operation ####

The abstract operation CreateSubscription with argument *unsubscribe* performs the
following steps:

1. Let *subscription* be ObjectCreate(%ObjectPrototype%).
1. Perform CreateDataProperty(*subscription*, **"unsubscribe"**, *unsubscribe*).
1. Return *subscription*.

#### Observable.prototype.forEach(callbackfn [, thisArg]) ###

The **forEach** function subscribes to the Observable object, calling *callbackfn*
once for each value in the sequence.  It returns a Promise object which is either
fulfilled with **undefined** when the sequence terminates normally or rejected
with the error value of the sequence.

The *forEach* function performs the following steps:

1. Let *O* be ToObject(**this** value).
1. ReturnIfAbrupt(*O*).
1. If *thisArg* was supplied, let *T* be *thisArg*; else let *T* be **undefined**.
1. Let *promiseCapability* be NewPromiseCapability(%Promise%).
1. ReturnIfAbrupt(*promiseCapability*).
1. If IsCallable(*callbackfn*) is **false**,
    1. Let *rejectResult* be Call(*promiseCapability*.[[Reject]], **undefined**, «a newly
        created **TypeError** object»).
    1. ReturnIfAbrupt(*rejectResult*).
    1. Return *promiseCapability*.[[Promise]].
1. Let *observerNext* be a new built-in anonymous function which performs the following
   steps when called with argument *value*:
   1. Let *nextResult* be Call(*callbackfn*, *T*, «‍value»).
   1. ReturnIfAbrupt(*nextResult*).
   1. Return **undefined**.
1. Let *observerThrow* be *promiseCapability*.[[Reject]].
1. Let *observerReturn* be a new built-in anonymous function which performs the following
   steps when called with argument *value*:
   1. Let *returnResult* be Call(*promiseCapability*.[[Resolve]], **undefined**, «‍**undefined**»).
   1. ReturnIfAbrupt(*returnResult*).
   1. Return **undefined**.
1. Let *observer* be ObjectCreate(%ObjectPrototype%).
1. Perform CreateDataProperty(*observer*, **"next"**, *observerNext*).
1. Perform CreateDataProperty(*observer*, **"throw"**, *observerThrow*).
1. Perform CreateDataProperty(*observer*, **"return"**, *observerReturn*).
1. Let *result* be Invoke(*O*, **"subscribe"**, «‍*observer*»).
1. IfAbruptRejectPromise(*result*, *promiseCapability*).
1. Return *promiseCapability*.[[Promise]].

#### Subscription Observer Objects ####

A Subscription Observer is an object which wraps the *observer* argument supplied to the
*subscribe* method of Observable objects.  Subscription Observer objects are passed as
the single parameter to an observable's *subscriber* function.  They enforce the following
guarantees:

- If the observer's **next** method returns an iterator result object with a **done**
  property whose value is **true**, then the observer will not be invoked again and the
  observable's cancellation function will be called.
- If the observer's **throw** method is called, then the observer will not be invoked
  again and the observable's cancellation function will be called.
- If the observer's **return** method is called, then the observer will not be invoked
  again and the observable's cancellation function will be called.
- The observable's cancellation function will be called at most one time.
- After the cancellation function has returned, the observer will not be invoked again.

In addition, Subscription Observer objects provide default behaviors when the observer
does not implement **throw** or **return**.

#### CreateSubscriptionObserver(observer) Abstract Operation ####

The abstract operation CreateSubscriptionObserver with argument *observer* is used to
create a normalized observer which can be supplied the an observable's *subscriber*
function.  It performs the following steps:

1. Assert: Type(*observer*) is Object.
1. Let *subscriptionObserver* be ObjectCreate(%SubscriptionObserverPrototype%,
   «‍[[Observer]], [[Subscription]]»).
1. Set *subscriptionObserver's* [[Observer]] internal slot to *observer*.
1. Set *subscriptionObserver's* [[Subscription]] internal slot to *subscription*.
1. Return *subscriptionObserver*.

#### CloseSubscription(subscriptionObserver) Abstract Operation ####

The abstract operation CloseSubscription with argument *subscriptionObserver* performs the
following steps:

1. Assert: The value of the [[Observer]] internal slot of *subscriptionObserver* is not **undefined**.
1. Set the value of the [[Observer]] internal slot of *subscriptionObserver* to **undefined**.
1. Return CancelSubscription(*subscriptionObserver*).

#### CancelSubscription(subscriptionObserver) Abstract Operation ####

The abstract operation CancelSubscription with argument *subscriptionObserver* performs the
following steps:

1. Let *subscription* be the value of the [[Subscription]] internal slot of *subscriptionObserver*.
1. If *subscription* is **undefined**, return **undefined**.
1. Assert: Type(*subscription*) is Object.
1. Set the value of the [[Subscription]] internal slot of *subscriptionObserver* to **undefined**.
1. Let *result* be Invoke(*subscription*, **"unsubscribe"**, «‍»).
1. Set the value of the [[Observer]] internal slot of *subscriptionObserver* to **undefined**.
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
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *observer* is **undefined**, return CreateIterResultObject(**undefined**, **true**).
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
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *observer* is **undefined**, return Completion{[[type]]: **throw**, [[value]]:
   *exception*, [[target]]: **empty**}.
1. Set the value of the [[Observer]] internal slot of *O* to **undefined**.
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
1. If *O* does not have all of the internal slots of a Subscription Observer instance,
   throw a **TypeError** exception.
1. Let *subscription* be the value of the [[Subscription]] internal slot of *O*.
1. Let *observer* be the value of the [[Observer]] internal slot of *O*.
1. If *observer* is **undefined**, return CreateIterResultObject(**value**, **true**).
1. Set the value of the [[Observer]] internal slot of *O* to **undefined**.
1. Let *result* be Get(*observer*, **"return"**).
1. If *result*.[[type]] is **normal**,
    1. Let *returnAction* be *result*.[[value]].
    1. If IsCallable(*returnAction*) is **true**,
        1. Let *result* be Call(*returnAction*, *observer*, «‍value»).
    1. Else,
        1. Let *result* be NormalCompletion(CreateIterResultObject(**value**, **true**)).
1. Let *cancelResult* be CancelSubscription(*subscription*).
1. ReturnIfAbrupt(*cancelResult*).
1. Return Completion(*result*).
