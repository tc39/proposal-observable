class ObserverSink {

    constructor(observer) {

        this.done = false;
        this.controller = undefined;
        this.observer = observer;
    }

    close() {

        this.done = true;

        if (this.controller && "stop" in this.controller)
            this.controller.stop();
    }

    next(value) {

        // If the stream if closed, then return a "done" result
        if (this.done)
            return { done: true };

        let result;

        try {

            // Send the next value to the sink
            result = this.observer.next(value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            this.close();
            throw e;
        }

        // Cleanup if sink is closed
        if (result && result.done)
            this.close();

        return result;
    }

    throw(value) {

        // If the stream is closed, throw the error to the caller
        if (this.done)
            throw value;

        this.done = true;

        try {

            // If the sink does not support "throw", then throw the error to the caller
            if (!("throw" in this.observer))
                throw value;

            return this.observer.throw(value);

        } finally {

            this.close();
        }
    }

    return(value) {

        // If the stream is closed, then return a done result
        if (this.done)
            return { done: true };

        this.done = true;

        try {

            // If the sink does not support "return", then return a done result
            if (!("return" in this.observer))
                return { done: true };

            return this.observer.return(value);

        } finally {

            this.close();
        }
    }
}

class Observable {

    constructor(init) {

        // The stream initializer must be a function
        if (typeof init !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._init = init;
    }

    subscribe(observer) {

        // The sink must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        let sink = new ObserverSink(observer),
            controller;

        try {

            // Call the stream initializer.  The initializer will return a
            // stream controller or undefined.
            controller = this._init.call(undefined, sink);

            // The returned controller may be null or undefined
            if (controller == null)
                controller = {};

            // The controller must be an object
            if (Object(controller) !== controller)
                throw new TypeError("Stream controller must be an object");

            if ("start" in controller)
                controller.start();

        } catch (e) {

            // If an error occurs during startup, then send an error
            // to the sink and rethrow error to caller.
            sink.throw(e);
            throw e;
        }

        // If the stream is already finished, then perform cleanup
        if (sink.done && "stop" in controller)
            controller.stop();

        sink.controller = controller;

        // Return a cancellation function
        return _=> {

            if ("cancel" in controller) controller.cancel();
            else sink.return();
        };
    }

    forEach(fn) {

        return new Promise((resolve, reject) => {

            this.subscribe({

                next: fn,
                throw: reject,
                return: resolve,
            });
        });
    }

    map(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new this.constructor(sink => ({

            stop: this.subscribe({

                next(value) {

                    try { value = fn(value) }
                    catch (e) { return sink.throw(e) }

                    return sink.next(value);
                },

                throw(value) { return sink.throw(value) },
                return(value) { return sink.return(value) },
            })

        }));
    }

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        return new this.constructor(sink => ({

            stop: this.subscribe({

                next(value) {

                    try { if (!fn(value)) return { done: false } }
                    catch (e) { return sink.throw(e) }

                    return sink.next(value);
                },

                throw(value) { return sink.throw(value) },
                return(value) { return sink.return(value) },
            })

        }));
    }

}
