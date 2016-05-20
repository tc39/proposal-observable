// === Non-Promise Job Queueing ===

const enqueueJob = (function() {

    // Node
    if (typeof global !== "undefined" &&
        typeof process !== "undefined" &&
        process.nextTick) {

        return global.setImmediate ?
            fn => { global.setImmediate(fn) } :
            fn => { process.nextTick(fn) };
    }

    // Newish Browsers
    let Observer = self.MutationObserver || self.WebKitMutationObserver;

    if (Observer) {

        let div = document.createElement("div"),
            twiddle = _=> div.classList.toggle("x"),
            queue = [];

        let observer = new Observer(_=> {

            if (queue.length > 1)
                twiddle();

            while (queue.length > 0)
                queue.shift()();
        });

        observer.observe(div, { attributes: true });

        return fn => {

            queue.push(fn);

            if (queue.length === 1)
                twiddle();
        };
    }

    // Fallback
    return fn => { setTimeout(fn, 0) };

})();

// === Symbol Polyfills ===

function polyfillSymbol(name) {

    if (!Symbol[name])
        Object.defineProperty(Symbol, name, { value: Symbol(name) });
}

polyfillSymbol("observable");

// === Abstract Operations ===

function nonEnum(obj) {

    Object.getOwnPropertyNames(obj).forEach(k => {
        Object.defineProperty(obj, k, { enumerable: false });
    });

    return obj;
}

function getMethod(obj, key) {

    let value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function cleanupSubscription(subscription) {

    // Assert:  observer._observer is undefined

    let cleanup = subscription._cleanup;

    if (!cleanup)
        return;

    // Drop the reference to the cleanup function so that we won't call it
    // more than once
    subscription._cleanup = undefined;

    // Call the cleanup function
    cleanup();
}

function subscriptionClosed(subscription) {

    return subscription._observer === undefined;
}

function closeSubscription(subscription) {

    if (subscriptionClosed(subscription))
        return;

    subscription._observer = undefined;
    cleanupSubscription(subscription);
}

function cleanupFromSubscription(subscription) {
    return _=> { subscription.unsubscribe() };
}

function Subscription(observer, subscriber) {

    // Assert: subscriber is callable

    // The observer must be an object
    if (Object(observer) !== observer)
        throw new TypeError("Observer must be an object");

    this._cleanup = undefined;
    this._observer = observer;

    let start = getMethod(observer, "start");

    // If the observer has a start method, call it with the subscription object
    if (start)
        start.call(observer, this);

    // If the observer has unsubscribed from the start method, exit
    if (subscriptionClosed(this))
        return;

    observer = new SubscriptionObserver(this);

    try {

        // Call the subscriber function
        let cleanup = subscriber.call(undefined, observer);

        // The return value must be undefined, null, a subscription object, or a function
        if (cleanup != null) {

            if (typeof cleanup.unsubscribe === "function")
                cleanup = cleanupFromSubscription(cleanup);
            else if (typeof cleanup !== "function")
                throw new TypeError(cleanup + " is not a function");

            this._cleanup = cleanup;
        }

    } catch (e) {

        // If an error occurs during startup, then attempt to send the error
        // to the observer.  If the subscription is already closed, then the
        // error will be rethrown.
        observer.error(e);
        return;
    }

    // If the stream is already finished, then perform cleanup
    if (subscriptionClosed(this))
        cleanupSubscription(this);
}

Subscription.prototype = nonEnum({
    get closed() { return subscriptionClosed(this) },
    unsubscribe() { closeSubscription(this) },
});

function SubscriptionObserver(subscription) {
    this._subscription = subscription;
}

SubscriptionObserver.prototype = nonEnum({

    get closed() {

        return subscriptionClosed(this._subscription);
    },

    next(value) {

        let subscription = this._subscription;

        // If the stream if closed, then return undefined
        if (subscriptionClosed(subscription))
            return undefined;

        let observer = subscription._observer;

        try {

            let m = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m)
                return undefined;

            // Send the next value to the sink
            return m.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            try { closeSubscription(subscription) }
            finally { throw e }
        }
    },

    error(value) {

        let subscription = this._subscription;

        // If the stream is closed, throw the error to the caller
        if (subscriptionClosed(subscription))
            throw value;

        let observer = subscription._observer;
        subscription._observer = undefined;

        try {

            let m = getMethod(observer, "error");

            // If the sink does not support "error", then throw the error to the caller
            if (!m)
                throw value;

            value = m.call(observer, value);

        } catch (e) {

            try { cleanupSubscription(subscription) }
            finally { throw e }
        }

        cleanupSubscription(subscription);
        return value;
    },

    complete(value) {

        let subscription = this._subscription;

        // If the stream is closed, then return undefined
        if (subscriptionClosed(subscription))
            return undefined;

        let observer = subscription._observer;
        subscription._observer = undefined;

        try {

            let m = getMethod(observer, "complete");

            // If the sink does not support "complete", then return undefined
            value = m ? m.call(observer, value) : undefined;

        } catch (e) {

            try { cleanupSubscription(subscription) }
            finally { throw e }
        }

        cleanupSubscription(subscription);
        return value;
    },

});

export class Observable {

    // == Fundamental ==

    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(observer) {

        return new Subscription(observer, this._subscriber);
    }

    forEach(fn) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            this.subscribe({

                _subscription: null,

                start(subscription) { this._subscription = subscription },

                next(value) {

                    if (this._subscription.closed)
                        return;

                    try {

                        return fn(value);

                    } catch (err) {

                        reject(err);
                        this._subscription.unsubscribe();
                    }
                },

                error: reject,
                complete: resolve,
            });
        });
    }

    [Symbol.observable]() { return this }

    static get [Symbol.species]() { return this }

    // == Derived ==

    static from(x) {

        let C = typeof this === "function" ? this : Observable;

        if (x == null)
            throw new TypeError(x + " is not an object");

        let method = getMethod(x, Symbol.observable);

        if (method) {

            let observable = method.call(x);

            if (Object(observable) !== observable)
                throw new TypeError(observable + " is not an object");

            if (observable.constructor === C)
                return observable;

            return new C(observer => observable.subscribe(observer));
        }

        // TODO: Should we throw here if object does not have Symbol.iterator?

        return new C(observer => {

            // Assume that the object is iterable.  If not, then the observer
            // will receive an error.
            for (let item of x) {

                observer.next(item);

                if (observer.closed)
                    return;
            }

            observer.complete();
        });
    }

    static of(...items) {

        let C = typeof this === "function" ? this : Observable;

        return new C(observer => {

            for (let i = 0; i < items.length; ++i) {

                observer.next(items[i]);

                if (observer.closed)
                    return;
            }

            observer.complete();
        });
    }

}
