# Can Observable be built on CancelTokens rather than Subscriptions?

The current proposal specifies that the Observable prototype contains two methods that allow a consumer to receive their notifications:

1. forEach
2. subscribe

The forEach function accepts a Cancel Token, and executes unsubscription logic when a cancellation notification is received from the token.

In contrast, the subscribe method returns a Subscription object. Subscription objects are basically thunks which synchronously execute unsubscription logic.

It has been proposed that Observable’s `subscribe` method should accept a `CancelToken` rather than returning a `Subscription` object. The main rationale for this change is reduced API surface area. Rather than learning about two concepts which can be used to cancel an asynchronous operation, developers would only have to learn about one.


This document will explore whether Observable can be built on cancel tokens, and outline what changes (if any) would need to be made to both the cancelable promises and observable proposals.

## Replacing Subscriptions with CancelTokens

In order to implement Observable with CancelTokens rather than Subscriptions, the following changes must be made to the observable and cancelable promises specifications respectively:

1. Modify subscribe to accept a CancelToken instead of returning Subscription
2. Replace `error` method in Observer with `else` and `catch`
3. Replace SubscriptionObserver with CancelTokenObserver
4. Ensure CancelTokens weakly reference input tokens
5. Ensure CancelTokens propagate cancellation notifications synchronously

### Modifying subscribe to accept a CancelToken instead of returning a Subscription

This is the API of the Subscription-based Observable:
```js
interface Observable {
    constructor(subscriber : SubscriberFunction);
    subscribe(observer : Observer) : Subscription;
    // more snipped...
}

function SubscriberFunction(observer: SubscriptionObserver) : (void => void) | Subscription;
```

In order to build Observable on cancel tokens, the API of the Observable would need to be changed to this:

```js
interface Observable {
    constructor(subscriber : SubscriberFunction);
    subscribe(observer : Observer, token : CancelToken | void) : void;
    // more snipped.
}
function SubscriberFunction(observer: CancelTokenObserver, token : CancelToken) : void
```


Here’s an example of a CancelToken-based Observable being created and consumed:


```js
let bodyMouseMoves = new Observable((observer, token) => {
  handler = event => observer.next(event);
  token.promise.then(() => document.body.removeEventListener("mousemove", handler));
  document.body.addEventListener("mousemove", handler);
});

let { token, cancel } = CancelToken.source();
bodyMouseMoves.subscribe(
  {
    next(event) {
      if (event.clientX <= 50) {
        console.log("mouse hasn’t moved passed 50px");
      }
      else {
        token.cancel(new Cancel("Only want to listen to mouse until it moves passed 50px"));
      }
    }
  },
  token);
```


Note that in order to cancel a subscription, the consumer must cancel the token passed to `subscribe`. The Cancelable Promises proposal dictates that when an asynchronous function is canceled, the Promise must resolve to a Cancel object. In order to allow developers to avoid inadvertently catching Cancel objects, the Cancelable Promises proposal adds a `else` method to the Promise prototype. This method only receives rejected values which are not `Cancel` instances, allowing Cancel instances to propagate.


If Observables are to be built on cancel tokens, consumers must be able to differentiate whether a subscription closed due to either cancellation or error.

### Replacing `error` method in Observer with `else` and `catch`


In the Subscription-based proposal, Observers have only one method which receives errors:


```js
interface Observer {
  next(v:any):any
  error(e:anythingButCancel):any
  complete(v:any):any
}
```


If Subscriptions are to be replaced with CancelTokens, consumers of Observables must be differentiate whether a subscription was closed due to cancellation or error. One way of accomplishing this is to replace Observer’s `error` method with two methods: `else` and `catch`.


```js
interface Observer {
  next(v:any):any
  else(e:anythingButCancel):any
  catch(e:any):any
  complete(v:any):any
}
```


Note that the new Observer methods correspond to the Promise prototype methods proposed in the Cancelable Promises Proposal. If the `else` method is defined, the Observable will call it with the value - provided that the value is not a `Cancel` instance. Otherwise if the `catch` method is defined on the Observer, `catch` will be passed the value regardless of whether it is a Cancel instance or not.


This raises an important question: how will usercode which catches errors invoke the right method on the Observer? The Cancelable Promises proposal does not currently provide a brand check for `Cancel` instances. Furthermore `try` statements cannot contain both an `else` and `catch` block.


In the next section a change to the subscribe API will be proposed to enable Observable implementations to notify the right method on the Observer if a subscription is closed due to failure.

### Replacing SubscriptionObserver with CancelTokenObserver

The Subscription-based proposal specifies a SubscriptionObserver.

```js
interface SubscriptionObserver {

    // Sends the next value in the sequence
    next(value);

    // Sends the sequence error
    error(errorValue);

    // Sends the sequence completion value
    complete(completeValue);

    // A boolean value indicating whether the subscription is closed
    get closed() : Boolean;
}
```

In the Subscription-based proposal, a SubscriptionObserver is created which wraps the input Observer whenever `subscribe` is invoked. Then the `subscribe` method passes the SubscriptionObserver to the subscribe implementation provided to the Observable constructor.
Wrapping the observer in a SubscriptionObserver is beneficial for the following reasons:

* it normalizes the input Observer API, ensuring that all methods are present.
* it ensures that no notifications are delivered to the Observer after the subscription is closed.


if Subscriptions are replaced with Cancel Tokens,  it is necessary to replace the `SubscriptionObserver` with a `CancelTokenObserver`.


```js
class CancelTokenObserver {
   // Sends the next value in the sequence
    next(value);

    // If wrapped observer is CancelTokenObserver
    //   calls throw on wrapped observer
    // Else if errorValue is _not_ Cancel and wrapped observer has else method
    //   calls else on wrapped observer
    // Else if wrapped observer has catch method
    //   calls catch on wrapped observer
    throw(errorValue);

    // Receives all error values except Cancels
    else(errorValue);

    // When present alongside else method, receives only Cancels. If else method does not exist on Observer, receives all errors.
    catch(errorValue);

    // Sends the sequence completion value
    complete(completeValue);
}
```


The `CancelTokenObserver` provides the same benefits as the `SubscriptonObserver`. However in addition to the Observer contract, the CancelTokenObserver prototype contains a `throw` method.


If the Observer wrapped by CancelTokenObserver is a CancelTokenObserver, the throw method will forward the value to the wrapped Observer’s throw method. Otherwise if an `else` method is defined on the Observer wrapped by CancelTokenObserver, the throw method forwards its input value to that `else` method - provided that the input value is not a `Cancel` instance. Otherwise if the `catch` method is defined on the Observer wrapped by CancelTokenObserver then the throw method will forward its input to `catch`. Finally if no suitable method on the observer can be found to receive the caught value, the error will be logged using HostReportErrors.


In order to leverage throw, implementations of `subscribe` should always use the `catch` clause when invoking an operation that may fail. If a value is caught, the subscribe implementation should pass the value to the `CancelTokenObserver`’s throw method. This will ensure that the value is delegated to the correct method on the `Observer`.


Here’s an example of this pattern in action:


```js
function map(observable, projection) {
    return new Observable((observer, token) => {
        const self = this;
        let index = 0;
        observable.subscribe(
            {
                next(value) {
                    try {
                        value = projection(value, index++, self);
                    }
                    catch(e) {
                        return observer.throw(e);
                    }


                    observer.next(value);
                },
                catch(e) {
                    observer.throw(e);
                },
                complete(v) {
                    observer.complete(v);
                }
            },
            token);
    });
}
```


If it's input token is canceled, Observable’s subscribe method will notify the observer’s`catch` method. Here’s a polyfill of the Observable constructor and the `subscribe` method demonstrating how the Observer is notified on token cancellation.


```js
class Observable {
    constructor(subscriber) {
        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");


        this._subscriber = subscriber;
    }


    subscribe(observer, token) {
        if (Object(observer) !== observer) {
            throw new TypeError(observer + " is not a object");
        }


        if (token != null && Object(token) !== token) {
            throw new TypeError(token + " is not an object");
        }


        if (token == null) {
            token = new CancelToken(() => {});
        }


        token.promise.then(cancel => observer.catch(cancel));
        observer = new CancelTokenObserver(observer, token);


        const reason = token.reason;
        if (reason) {
            return observer.catch(reason);
        }


        try {
            this._subscriber(observer, token);
        } catch(e) {
            observer.throw(e);
        }
    }
    // rest snipped...
}
```


On the surface the CancelToken-based implementation of `subscribe` appears to be more efficient than the Subscription-based implementation. Note that a single `CancelToken` may be used by many Observables. In the Subscription-based proposals, many functions which compose Observables generate a Subscription per call to `subscribe`. Under the circumstances it would appear as though the CancelToken-based proposal may require fewer allocations than the Subscription-based proposal.


Unfortunately the implementation above will leak memory when some common Observable compositions are applied. In the following sections this memory leak will be explained, a change to the implementation will be proposed to avoid it, and finally a change to the CancelToken specification will be rationalized.

### Modifying `CancelToken.prototype.race` to weakly retain references to all  input tokens


The implementation of `subscribe` in the previous section does not allow certain common composition operations to be written without introducing a memory leak. As an example, consider the `flatten` function which is commonly applied to Observables:

```js
import _ from "lodashforObservables";

let mouseDowns = document.body.on(‘mousedown’);
let mouseUps = document.body.on(‘mouseup’);
let mouseMoves = document.body.on(‘mousemove’);

let mouseDrags =
  _(mouseDowns).
    map(() => _(mouseMoves).takeUntil(mouseUps)).
    flatten();
```

The code above creates an Observable that notifies all of the mouse moves that occur between a mouse down and mouse up event.

The `flatten` function accepts an input Observable of Observables, and returns a new Observable which notifies its Observer of the data in each of the Observables in the input Observable. Consider the following example:


```js
import _ from "lodashforObservables";

flatten(Observable.of(
   Observable.of(1,2,3),
   Observable.of(4,5,6))).
   forEach(x => console.log(x));
```


With the code above is run, the following console output is expected:

```
1
2
3
4
5
6
```

The `flatten` function allows an long-running asynchronous operation to be composed together from multiple smaller asynchronous operations. Consider the following code which looks for a stock that matches a particular criteria:

```js
import _ from "lodashforObservables";
async function buyFirstMatchStock(stocks) {
  var stockInfo = await _(stocks).
      map(symbol =>
        _.fromPromise(getStockInfoPromise(symbol)).
      flatten().
      filter(stockInfo => matchesLocalCritera(stockInfo)).
      first();

  let purchasePrice = await purchase(stockInfo);
  return purchasePrice;
}
```

Note that this async function may run for a long time, as well as spawn many smaller async operations as it retrieves the info for each stock from a remote service.

Now consider the following implementation of `flatten`:

```js
function flatten(observable) {
    return new Observable((observer, token) => {
        let outerObservableDone = false;
        let innerObservables = 0;

        observable.subscribe({
            next(innerObservable) {
                innerObservables++;

                innerObservable.subscribe(
                    {
                        next(value) {
                            observer.next(value);
                        },
                        catch(e) {
                            innerObservables--;
                            observer.throw(e);
                        },
                        complete(v) {
                            innerObservables--;
                            if (innerObservables === 0 && outerObservableDone) {
                                observer.complete(v);
                            }
                        }
                    },
                    token);
            },
            catch(e) {
                observer.throw(e);
            },
            complete(v) {
                outerObservableDone = true;
                if (innerObservables === 0) {
                    observer.complete(v);
                }
            }
        },
        token);
    });
}
```

This implementation of flatten contains a memory leak. In the following sections, the root cause of the leak will be explained, and a solution will be proposed.

#### Memory leaks and the inability to unsubscribe from cancellation notifications

In the previous section it was suggested that the implementation of flatten had a memory leak. However rather than focus on the definition of flatten, it will be demonstrated that the root cause of the leak is in the implementation of Observable.prototype.subscribe suggested earlier in this document.


Consider the (truncated) definition of Observable.prototype.subscribe again:


```js
class Observable {
   subscribe(observer, token) {
        // input validation snipped...
        if (token == null) {
            token = new CancelToken(() => {});
        }
        observer = new CancelTokenObserver(observer, token);
        token.promise.then(cancel => observer.catch(cancel));
        // call to subscribe implementation snipped...
    }
    // snip...
}
```

Note that subscribe attaches a handler to the input token’s Promise in order to inform the Observer in case of token cancellation. Furthermore note that when the input token is passed to the subscribe implementation, the implementation may also attach cleanup logic to the token to be executed if the token is canceled. This enables subscribe implementations to free resources in the event the subscription is closed due to cancellation.

There is a problem with using this approach to ensure that resources are cleaned up when a subscription is closed. JavaScript’s proposed cancel tokens use a Promise to notify consumers of cancellation.

```js
var source = CancelToken.source();
var token = source.token;
token.promise.then(cancel => {
    // cleanup logic
});
```

Note that there is no way to detach a handler to a Promise in JavaScript except to resolve the Promise. That means that **once a cancellation handler has been attached to a cancel token, it cannot be detached until the token is canceled.** JS CancelTokens are notably different than .NET Cancellation Tokens in this respect, because .NET Cancellation Tokens allow handlers to be unsubscribed using an Observer-like interface.

```cs
CancellationTokenSource source = new CancellationTokenSource();
CancellationToken token = source.Token;

// register
CancellationTokenRegistration registration = token.Register(() => {
    // cleanup logic
})

// unregister
registration.Dispose();
```

The inability to detach a cancellation handler from a cancel token is the root cause of the memory leak in flatten. When a subscription closes, the cleanup logic the implementation registered with the token cannot detached. As a result the current implementation leaks memory when operations like flatten are applied, which can create a long running async Observables out of many (potentially short-lived) Observables.  As the flattened Observable subscribes to inner Observables, cleanup logic may be attached to the token. However as each of these subscription closes, cleanup logic is not run, nor is the handler detached.

The implementation of `flatten` below is identical to the one included earlier in the document, but annotates the code with comments detailing the memory leak:

```js
function flatten(observable) {
    return new Observable((observer, token) => {
        let outerObservableDone = false;
        let innerObservables = 0;

        // Each Observable received from this stream will attach a
        // handler to the token on subscription. This handler will remain
        // attached until the token received by `subscribe` is cancelled -  
        // even after the subscription to the Observable has closed.
        observable.subscribe({
            next(innerObservable) {
                innerObservables++;

                // handler attached to token.promise
                innerObservable.subscribe(
                    {
                        next(value) {
                            observer.next(value);
                        },
                        catch(e) {
                            // handler not detached from promise,
                            // even though innerObservable subscription
                            // is closed
                            innerObservables--;
                            observer.throw(e);
                        },
                        complete(v) {
                            // handler not detached from promise,
                            // even though innerObservable subscription
                            // is closed
                            innerObservables--;
                            if (innerObservables === 0 && outerObservableDone) {
                                observer.complete(v);
                            }
                        }
                    },
                    token);
            },
            catch(e) {
                observer.throw(e);
            },
            complete(v) {
                outerObservableDone = true;
                if (innerObservables === 0) {
                    observer.complete(v);
                }
            }
        },
        token);
    });
}
```

The `flatten` operator demonstrates that a long-running operation cannot share CancelToken’s among many Observables without leaking memory. In the next section we’ll modify the polyfill `subscribe` to allow each implementation to free its resources once the subscription closes.

#### Enabling Observables to cleanup when a subscription is closed

In the previous section we demonstrated that sharing a single cancel token among multiple Observables can create memory leaks when long-running asynchronous operations are composed out of many smaller asynchronous operations. One solution to this problem is to create a new CancelToken for each call to subscribe.

Consider the following (revised) polyfill of Observable.prototype.subscribe:

```js
export class Observable {
    subscribe(observer, outerToken) {
        let token;
        // argument validation omitted...

        // Create new CancelToken for this Subscription operation and
        // link it to the Observable.
        const { token: innerToken, cancel } = CancelToken.source();
        token = outerToken != null ? CancelToken.race([outerToken, innerToken]) : innerToken;

        // The cancel fn is passed to the CancelTokenObserver so that it
        // can cleanup subscription resources when it receives a
        // else or complete notification
        observer = new CancelTokenObserver(observer, token, cancel);
        token.promise.then(c => observer.catch(c));

        const reason = token.reason;
        if (reason) {
            return observer.catch(reason);
        }

        try {
            this._subscriber(observer, token);
        } catch(e) {
            observer.throw(e);
        }
    }
```


Note that Observable’s subscribe method creates a new CancelTokenSource each time it is invoked. Then a raced token is created created from the source token and the input token, and the raced token is subsequently passed to the subscribe implementation. The net effect is that a cancel token is created specifically for each subscription.

In order to ensure that a subscribe implementation’s clean up logic is executed when the subscription is closed, the source’s cancel function is passed to the `CancelTokenObserver` along with the token. The CancelTokenObserver runs the cancel function whenever an `else` or `complete` notification is received. This causes cleanup logic to be run whenever a subscription is closed.

Note this logic in the polyfill of `CancelTokenObserver.prototype.else` below:

```js
// Abstract operation
function closeCancelTokenObserver(cancelTokenObserver) {
    cancelTokenObserver._closed = true;
    cancelTokenObserver._observer = undefined;
    cancelTokenObserver._subscriptionCancel = new Cancel("Subscription canceled.");
    cancelTokenObserver._cancel(cancelTokenObserver._subscriptionCancel);
}

class CancelTokenObserver {
    constructor(observer, token, cancel) {
        this._observer = observer;
        this._token = token;
        this._cancel = cancel;
    }
    // other methods snipped...
    complete(value) {
        // if token is cancelled, noop
        if (isCancelTokenObserverTokenCancelled(this)) {
            return;
        }


        let observer = this._observer;
        // close subscription by cancelling token
        closeCancelTokenObserver(this);


        let m = getMethod(observer, "complete");


        if (m) {
            try {
                m.call(observer, value);
            }
            catch(e) {
                // HostReportErrors(e)
            }
        }
    }
}
```

Note the `complete` method cancels the token created specifically for this subscription, ensuring that resources are cleaned up when the subscription closes.

Creating a new CancelToken per subscription allows subscriptions to cleanup their resources as soon as a subscription is closed. However this alone is not enough to eliminate all memory leaks.  Depending on the implementation of CancelToken.prototype.race, this implementation may simply trade one leak for another. In the next section this problem will be explained in more detail, and an implementation of CancelToken.prototype.race will be proposed which eliminates the memory leak.

### Ensuring CancelTokens weakly reference input tokens

Recall that in the previous section the polyfill of the `subscribe` implementation was modified to create a raced CancelToken from a new source token and the input token, and passed the raced token to the `subscribe` implementation:


export class Observable {
    subscribe(observer, outerToken) {
        let token;
        // argument validation omitted...


        // Create new CancelToken for this Subscription operation and
        // link it to the Observable.
        const { token: innerToken, cancel } = CancelToken.source();
        token = outerToken != null ? CancelToken.race([outerToken, innerToken]) : innerToken;


        // The cancel fn is passed to the CancelTokenObserver so that it
        // can cleanup subscription resources when it receives a
        // else or complete notification
        observer = new CancelTokenObserver(observer, token, cancel);
        token.promise.then(c => observer.catch(c));
        // pass token to subscribe implementation
    }
}


Note that in order to avoid memory leaks the subscribe implementation assumes that input tokens passed to CancelToken.prototype.race weakly reference the raced token. If not there is still a memory leak, because just as there is no way to detach a Promise handler, there is also no way to unlink a raced token from its input tokens.


Consider the most obvious implementation of CancelToken.prototype.race:


```js
class CancelToken {
  // snip…
  static race(cancelTokens) {
    return new CancelToken(cancel => {
      Promise.race(cancelTokens.map(token => token.promise)).then(cancel);
    });
  }
}
```


Note that the implementation above will cause a reference to the raced canceltoken to be captured indirectly by all cancel tokens via the raced promise. If we assume that CancelToken uses the implementation of CancelToken.prototype.race above, then the memory leak has simply been moved rather than removed. In a long-running async operation like `flatten`, more and more tokens will be linked as each new Observables is subscribed. These references will be retained - even after the subscription has been closed.


The memory leak can be eliminated if the implementation of `CancelToken.prototype.race` is modified like so:


```js
class CancelToken {
  // snip…
  static race(inputTokens) {
    let tokenCancel;
    let token = new CancelToken(cancel => tokenCancel = cancel);
    for(let inputToken of inputTokens) {
      addWeakRefToLinkedCancelFunction(inputToken, tokenCancel);
    }
    return token;
  }
}
```


When a token is cancelled, it iterates its list of weak references and forwards the `Cancel` instance to each cancel function found in the list.


```js
export default class CancelToken {
  constructor(fn) {
    let promiseCancel;


    this.promise = new Promise((accept, reject) => {
      promiseCancel = accept;
    });


    let cancel = reason => {
      this.reason = reason;
      let weakRefs = getCancelTokenWeakRefs(this);
      for(let weakRef of weakRefs) {
        let linkedCancel = getWeakRefValue(weakRef);
        if (linkedCancel) {
          linkedCancel(reason);
        }
      }
      clearCancelTokenWeakRefs(this);
      promiseCancel(reason);
    }


    fn(cancel);
  }


  // more functions snipped...
}
```

This approach largely mitigates the memory leak by ensuring that raced tokens associated with completed Observable subscriptions can be collected by GC. However it's worth noting that another side effect of the implementation above is that cancellation propagates to linked tokens synchronously. This is fortuitous, because in addition to weakly referenced linked tokens, synchronous cancellation propagation is essential if the implementation of Observable on CancelTokens proposed in the document is to be viable. The next section will explain why sync cancellation propagation is necessary in order to implement Observables on CancelTokens.

### Ensuring CancelTokens synchronously propagate cancellation

In the previous section we provided a naïve implementation of CancelToken.prototype.race which used promises to propagate cancellation.

```js
class CancelToken {
  // snip…
  static race(cancelTokens) {
    return new CancelToken(cancel => {
      Promise.race(cancelTokens.map(token => token.promise)).then(cancel);
    });
  }
}
```
One implication of the use of Promises in the naive `race` implementation’s is that cancellation will be propagated to linked tokens _asynchronously_. Async cancellation propagation is not compatible with the CancelToken-based implementation of Observable proposed in this document. The problem is that if cancellation is _not_ propagated synchronously, notifications can be delivered to an Observer after a token has been cancelled.

The following code creates an Observable that can multi-cast messages to multiple observers:

```js
let capturedObservers = new Set();
let subject = new Observable((observer, token) => {
  capturedObservers.add(observer);
  token.promise.then(() => capturedObservers.delete(observer));
});

let { token, cancel } = CancelToken.source();

subject.subscribe({
  next(msg) { console.log(msg); }
}, token);

cancel(new Cancel("Closing subscription"));

for(let observer of capturedObservers) {
  observer.next("message");
}
```

Recall that Observable enforces the invariant that **no notification is delivered to an Observer after a subscription has been closed.** In this regard Observables match the behavior of Iterators, which never produce new values after they have completed. Note in the example above that the token is cancelled prior to any Observer being notified. Under the circumstances we would expect no console output as a result of the Observers being notified. However if we ran the code above we would observe the following console output (assuming the naive implementation of CancelToken.prototype.race):

```
message
```

In order to understand why the message is delivered to the Observer after the token passed to subscribe has been cancelled, consider the implementation of `subscribe` again:

```js
export class Observable {
    subscribe(observer, outerToken) {
        let token;
        // argument validation omitted...

        // Create new CancelToken for this Subscription operation and
        // link it to the Observable.
        const { token: innerToken, cancel } = CancelToken.source();
        token = outerToken != null ? CancelToken.race([outerToken, innerToken]) : innerToken;

        // The cancel fn is passed to the CancelTokenObserver so that it
        // can cleanup subscription resources when it receives a
        // else or complete notification
        observer = new CancelTokenObserver(observer, token, cancel);
        token.promise.then(c => observer.catch(c));

        const reason = token.reason;
        if (reason) {
            return observer.catch(reason);
        }


        try {
            this._subscriber(observer, token);
        } catch(e) {
            observer.throw(e);
        }
    }
}
```

Note that the input cancel token passed to subscribe is not passed directly to the subscribe implementation provided to the Observable constructor. Instead, a raced CancelToken is created from the input cancel token and a new cancel token created specifically for the subscription. Assuming async propagation of cancellation, the token received by the subscribe implementation will not receive the cancellation notification within the same job as cancellation was invoked. As a consequence the Observer receives all notifications dispatched in the same job in which the input token cancellation is executed.

If the alternate implementation of CancelToken.prototype.race described in the previous implementation is used instead, the raced token receives the cancellation in the same job as the in in which the input token cancellation is executed. As a consequence, no console output would be received as expected.

## Observable can be implemented on CancelTokens

Assuming the implementation of `CancelToken.prototype.race` proposed in this document, Observable can be implemented on CancelTokens with no loss of expressiveness. For a reference implementation, see [here](https://github.com/jhusain/proposal-observable/blob/master/src/Observable.js).
