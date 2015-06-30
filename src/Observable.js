// === Job Queueing ===

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

function cancelSubscription(observer) {

    // Assert:  observer._observer is undefined

    let subscription = observer._subscription;

    if (!subscription)
        return;

    // Drop the reference to the subscription so that we don't unsubscribe
    // more than once
    observer._subscription = undefined;

    // Call the cancellation function
    subscription.cancel();
}

function closeSubscription(observer) {

    observer._observer = undefined;
    cancelSubscription(observer);
}

function isCancelable(x) {

    return Object(x) === x && typeof x.cancel === "function";
}

class SubscriptionObserver {

    constructor(observer) {

        this._observer = observer;
        this._subscription = undefined;
    }

    next(value) {

        let observer = this._observer;

        // If the stream if closed, then return a "done" result
        if (!observer)
            return { value: undefined, done: true };

        let result;

        try {

            let m = getMethod(observer, "next");

            // Send the next value to the sink
            if (m)
                result = m.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            closeSubscription(this);
            throw e;
        }

        // Cleanup if sink is closed
        if (result && result.done)
            closeSubscription(this);

        return result;
    }

    throw(value) {

        let observer = this._observer;

        // If the stream is closed, throw the error to the caller
        if (!observer)
            throw value;

        this._observer = undefined;

        try {

            let m = getMethod(observer, "throw");

            // If the sink does not support "throw", then throw the error to the caller
            if (!m)
                throw value;

            return m.call(observer, value);

        } finally {

            cancelSubscription(this);
        }
    }

    return(value) {

        let observer = this._observer;

        // If the stream is closed, then return a done result
        if (!observer)
            return { value, done: true };

        this._observer = undefined;

        try {

            let m = getMethod(observer, "return");

            // If the sink does not support "return", then return a done result
            if (!m)
                return { value, done: true };

            return m.call(observer, value);

        } finally {

            cancelSubscription(this);
        }
    }

}

export class Observable {

    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(observer) {

        // The sink must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        // Wrap the observer in order to maintain observation invariants
        observer = new SubscriptionObserver(observer);

        enqueueJob(_=> {

            // If the subscription has already been cancelled, then abort the
            // following steps
            if (!observer._observer)
                return;

            try {

                // Call the subscriber function
                let subscription = this._subscriber.call(undefined, observer);

                if (subscription != null && !isCancelable(subscription)) {

                    if (typeof subscription !== "function")
                        throw new TypeError(subscription + " is not a function");

                    subscription = { cancel: subscription };
                }

                observer._subscription = subscription;

            } catch (e) {

                // If an error occurs during startup, then attempt to send the error
                // to the observer
                observer.throw(e);
                return;
            }

            // If the stream is already finished, then perform cleanup
            if (!observer._observer)
                cancelSubscription(observer);
        });

        return {

            throw(value) { observer.throw(value) },
            return(value) { observer.return(value) },
            cancel() { cancelSubscription(observer) },
        };
    }

    [Symbol.observable]() { return this }

    forEach(fn, thisArg = undefined) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            this.subscribe({

                next(value) { fn.call(thisArg, value) },
                throw(value) { reject(value) },
                return(value) { resolve(undefined) },
            });
        });
    }

    map(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new this.constructor[Symbol.species](sink => this.subscribe({

            next(value) {

                try { value = fn.call(thisArg, value) }
                catch (e) { return sink.throw(e) }

                return sink.next(value);
            },

            throw(value) { return sink.throw(value) },
            return(value) { return sink.return(value) },
        }));
    }

    filter(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new this.constructor[Symbol.species](sink => this.subscribe({

            next(value) {

                try { if (!fn.call(thisArg, value)) return { done: false } }
                catch (e) { return sink.throw(e) }

                return sink.next(value);
            },

            throw(value) { return sink.throw(value) },
            return(value) { return sink.return(value) },
        }));
    }

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

            return new C(sink => observable.subscribe(sink));
        }

        method = getMethod(x, Symbol.iterator);

        if (!method)
            throw new TypeError(x + " is not observable");

        return new C(sink => {

            for (let item of method.call(x)) {

                let result = sink.next(item);

                if (result && result.done)
                    return;
            }

            sink.return();
        });
    }

    static of(...items) {

        let C = typeof this === "function" ? this : Observable;

        return new C(sink => {

            for (let item of items) {

                let result = sink.next(item);

                if (result && result.done)
                    return;
            }

            sink.return();
        });
    }

    static get [Symbol.species]() { return this }

}
