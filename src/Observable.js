// === Non-Promise Job Queueing ===

const enqueueJob = (function() {

    // Node
    if (typeof self === "undefined" && typeof global !== "undefined") {

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

function getMethod(obj, key) {

    let value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function cleanupSubscription(observer) {

    // Assert:  observer._observer is undefined

    let cleanup = observer._cleanup;

    if (!cleanup)
        return;

    // Drop the reference to the cleanup function so that we won't call it
    // more than once
    observer._cleanup = undefined;

    // Call the cleanup function
    cleanup();
}

function subscriptionClosed(observer) {

    return observer._observer === undefined;
}

class SubscriptionObserver {

    constructor(observer) {

        this._observer = observer;
        this._cleanup = undefined;
    }

    cancel() {

        this._observer = undefined;
        cleanupSubscription(this);
    }

    get closed() { return subscriptionClosed(this) }

    next(value) {

        // If the stream if closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        let observer = this._observer;

        try {

            let m = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m)
                return undefined;

            // Send the next value to the sink
            return m.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            this.cancel();
            throw e;
        }
    }

    error(value) {

        // If the stream is closed, throw the error to the caller
        if (subscriptionClosed(this))
            throw value;

        let observer = this._observer;
        this._observer = undefined;

        try {

            let m = getMethod(observer, "error");

            // If the sink does not support "error", then throw the error to the caller
            if (!m)
                throw value;

            return m.call(observer, value);

        } finally {

            cleanupSubscription(this);
        }
    }

    complete(value) {

        // If the stream is closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        let observer = this._observer;
        this._observer = undefined;

        try {

            let m = getMethod(observer, "complete");

            // If the sink does not support "complete", then return undefined
            if (!m)
                return undefined;

            return m.call(observer, value);

        } finally {

            cleanupSubscription(this);
        }
    }

}

export class Observable {

    // == Fundamental ==

    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(observer) {

        // The observer must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        // Wrap the observer in order to maintain observation invariants
        observer = new SubscriptionObserver(observer);

        // NOTE: This logic can be moved into the SubscriptionObserver
        // constructor to avoid cross-class private state access.  Should
        // it be moved?  To what extent is the SubscriptionObserver constructor
        // observable?

        try {

            // Call the subscriber function
            let cleanup = this._subscriber.call(undefined, observer);

            // The return value must be undefined, null, or a function
            if (cleanup != null && typeof cleanup !== "function")
                throw new TypeError(cleanup + " is not a function");

            observer._cleanup = cleanup;

        } catch (e) {

            // If an error occurs during startup, then attempt to send the error
            // to the observer
            observer.error(e);
            return;
        }

        // If the stream is already finished, then perform cleanup
        if (subscriptionClosed(observer))
            cleanupSubscription(observer);

        return _=> { observer.cancel() };
    }

    forEach(fn) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            this.subscribe({

                next(value) {

                    try { return fn(value) }
                    catch (x) { reject(x) }
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

        return new C(observer => {

            enqueueJob(_=> {

                if (observer.closed)
                    return;

                // Assume that the object is iterable.  If not, then the observer
                // will receive an error.
                try {

                    for (let item of x) {

                        observer.next(item);

                        if (observer.closed)
                            return;
                    }

                } catch (x) {

                    observer.error(x);
                    return;
                }

                observer.complete();
            });
        });
    }

    static of(...items) {

        let C = typeof this === "function" ? this : Observable;

        return new C(observer => {

            enqueueJob(_=> {

                try {

                    if (observer.closed)
                        return;

                    for (let i = 0; i < items.length; ++i) {

                        observer.next(items[i]);

                        if (observer.closed)
                            return;
                    }

                } catch (x) {

                    observer.error(x);
                    return;
                }

                observer.complete();
            });
        });
    }

    map(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C(observer => this.subscribe({

            next(value) {

                try { value = fn(value) }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error(value) { return observer.error(value) },
            complete(value) { return observer.complete(value) },
        }));
    }

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C(observer => this.subscribe({

            next(value) {

                try { if (!fn(value)) return undefined; }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error(value) { return observer.error(value) },
            complete(value) { return observer.complete(value) },
        }));
    }

}
