function cancelSubscription(subscription) {

    let cancel = subscription.cancel;

    if (cancel) {

        // Drop the reference to the termination function so that we don't
        // call it more than once.
        subscription.cancel = null;

        // Call the termination function
        cancel();
    }
}

function closeSubscription(subscription) {

    subscription.done = true;
    cancelSubscription(subscription);
}

function polyfillSymbol(name) {

    if (!Symbol[name])
        Object.defineProperty(Symbol, name, { value: Symbol(name) });
}

polyfillSymbol("observer");

class SubscriptionObserver {

    constructor(observer, subscription) {

        this._observer = observer;
        this._subscription = subscription;
    }

    next(value) {

        // If the stream if closed, then return a "done" result
        if (this._subscription.done)
            return { value: undefined, done: true };

        let result;

        try {

            // Send the next value to the sink
            result = this._observer.next(value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            closeSubscription(this._subscription);
            throw e;
        }

        // Cleanup if sink is closed
        if (result && result.done)
            closeSubscription(this._subscription);

        return result;
    }

    throw(value) {

        // If the stream is closed, throw the error to the caller
        if (this._subscription.done)
            throw value;

        this._subscription.done = true;

        try {

            // If the sink does not support "throw", then throw the error to the caller
            if (!("throw" in this._observer))
                throw value;

            return this._observer.throw(value);

        } finally {

            cancelSubscription(this._subscription);
        }
    }

    return(value) {

        // If the stream is closed, then return a done result
        if (this._subscription.done)
            return { value: undefined, done: true };

        this._subscription.done = true;

        try {

            // If the sink does not support "return", then return a done result
            if (!("return" in this._observer))
                return { done: true };

            return this._observer.return(value);

        } finally {

            cancelSubscription(this._subscription);
        }
    }
}

function enqueueMicrotask(fn) {

    // TODO: We don't want to use Promise.prototype.then to schedule a microtask,
    // because exceptions that occur during execution of `fn` need to be reported as
    // uncaught exceptions and not unhandled Promise rejections.
    Promise.resolve().then(fn);
}

export class Observable {

    constructor(executor) {

        // The stream initializer must be a function
        if (typeof executor !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._executor = executor;
    }

    subscribe(observer) {

        // The sink must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        let abort = false,
            cancel;

        enqueueMicrotask(_=> {

            if (!abort)
                cancel = this[Symbol.observer](observer);
        });

        return {

            unsubscribe() {
                if (cancel) cancel();
                else abort = true;
            }
        };
    }

    [Symbol.observer](observer) {

        // The sink must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        let subscription = { cancel: null, done: false },
            sink = new SubscriptionObserver(observer, subscription),
            cancel;

        try {

            // Call the stream initializer
            cancel = this._executor.call(undefined, sink);

            // If the return value is null or undefined, then use a default cancel function
            if (cancel == null)
                cancel = (_=> sink.return());
            else if (typeof cancel !== "function")
                throw new TypeError(cancel + " is not a function");

            subscription.cancel = cancel;

        } catch (e) {

            // If an error occurs during startup, then attempt to send the error
            // to the sink
            sink.throw(e);
        }

        // If the stream is already finished, then perform cleanup
        if (subscription.done)
            cancelSubscription(subscription);

        // Return a cancellation function.  The default cancellation function
        // will simply call return on the observer.
        return {
            unsubscribe() { cancelSubscription(subscription) }
        };
    }

    forEach(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new Promise((resolve, reject) => {

            this.subscribe({

                next: value => fn.call(thisArg, value),
                throw: reject,
                return: resolve,
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

    static get [Symbol.species]() { return this }

    static from(x) {

        if (Object(x) !== x)
            throw new TypeError(x + " is not an object");

        let subscribeFunction = x[Symbol.observer];

        if (typeof subscribeFunction !== "function")
            throw new TypeError(subscribeFunction + " is not a function");

        return new this[Symbol.species](sink => {

            let cancel = subscribeFunction.call(x, sink);
            return cancel;
        });
    }

}
