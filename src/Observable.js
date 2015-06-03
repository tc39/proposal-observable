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

polyfillSymbol("observer");

// === Abstract Operations ===

function cancelSubscription(observer) {

    let subscription = observer._subscription;

    if (subscription) {

        // Drop the reference to the subscription so that we don't unsubscribe
        // more than once.
        observer._subscription = undefined;

        // Call the unsubscribe function
        subscription.unsubscribe();
    }
}

function closeSubscription(observer) {

    observer._observer = undefined;
    cancelSubscription(observer);
}

function isSubscription(x) {

    return Object(x) === x && typeof x.unsubscribe === "function";
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

            // Send the next value to the sink
            result = observer.next(value);

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

            // If the sink does not support "throw", then throw the error to the caller
            if (!("throw" in observer))
                throw value;

            return observer.throw(value);

        } finally {

            cancelSubscription(this);
        }
    }

    return(value) {

        let observer = this._observer;

        // If the stream is closed, then return a done result
        if (!observer)
            return { value: undefined, done: true };

        this._observer = undefined;

        try {

            // If the sink does not support "return", then return a done result
            if (!("return" in observer))
                return { value: undefined, done: true };

            return observer.return(value);

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

        let unsubscribed = false,
            subscription;

        enqueueJob(_=> {

            if (!unsubscribed)
                subscription = this[Symbol.observer](observer);
        });

        return {

            unsubscribe() {

                if (unsubscribed)
                    return;

                unsubscribed = true;

                if (subscription)
                    subscription.unsubscribe();
            }
        };
    }

    [Symbol.observer](observer) {

        // The sink must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        // Wrap the observer in order to maintain observation invariants
        observer = new SubscriptionObserver(observer);

        let subscription;

        try {

            // Call the subscriber function
            subscription = this._subscriber.call(undefined, observer);

            if (!isSubscription(subscription)) {

                let unsubscribe = typeof subscription === "function" ?
                    subscription :
                    (_=> { observer.return() });

                subscription = { unsubscribe };
            }

        } catch (e) {

            // If an error occurs during startup, then attempt to send the error
            // to the observer
            observer.throw(e);
        }

        observer._subscription = subscription;

        // If the stream is already finished, then perform cleanup
        if (!observer._observer)
            cancelSubscription(observer);

        // Return the subscription object
        return subscription;
    }

    forEach(fn, thisArg = undefined) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            this.subscribe({

                next: value => { fn.call(thisArg, value) },
                throw: reject,
                return: resolve,
            });
        });
    }

    static from(x) {

        if (Object(x) !== x)
            throw new TypeError(x + " is not an object");

        let subscribeFunction = x[Symbol.observer];

        if (typeof subscribeFunction !== "function")
            throw new TypeError(subscribeFunction + " is not a function");

        return new this.constructor(sink => subscribeFunction.call(x, sink));
    }

    // === EXPERIMENTAL:  NOT SPECIFIED ===

    map(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new this.constructor[Symbol.species](sink => this[Symbol.observer]({

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

        return new this.constructor[Symbol.species](sink => this[Symbol.observer]({

            next(value) {

                try { if (!fn.call(thisArg, value)) return { done: false } }
                catch (e) { return sink.throw(e) }

                return sink.next(value);
            },

            throw(value) { return sink.throw(value) },
            return(value) { return sink.return(value) },
        }));
    }

    static get [Symbol.species]() { return this }

}
