import CancelToken from './CancelToken';
import Cancel from './Cancel';

// special cancel used to cancel subscriptions, needs brand check
function isSubscriptionCancel(maybeSubscriptionCancel) {
    return maybeSubscriptionCancel instanceof SubscriptionCancel;
}

class SubscriptionCancel extends Cancel {
    constructor(message) {
        super(message)
    }
}

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

function isCancelTokenObserverClosed(cancelTokenObserver) {
    return cancelTokenObserver._token.reason !== undefined;
}

function isCancelTokenObserver(maybeCancelTokenObserver) {
    return maybeCancelTokenObserver instanceof CancelTokenObserver;
}

function closeCancelTokenObserver(cancelTokenObserver) {
    cancelTokenObserver._observer = undefined;
    cancelTokenObserver._cancel(new SubscriptionCancel());
}

function CancelTokenObserver(observer, sourceToken) {
    const { token: inputToken, cancel } = CancelToken.source();
    const token = CancelToken.race([sourceToken, inputToken]);

    this._observer = observer;
    this._token = token;
    this._cancel = cancel;
    token.promise.then(c => this.catch(c));
}

function isCancel(maybeCancel) {
    return maybeCancel instanceof Cancel;
}

CancelTokenObserver.prototype = nonEnum({
    next(value) {
        // If the stream if closed, then return undefined
        if (isCancelTokenObserverClosed(this)) {
            return undefined;
        }

        let observer = this._observer;

        let m = getMethod(observer, "next");

        // If the observer doesn't support "next", then return undefined
        if (!m)
            return undefined;

        // Send the next value to the sink
        try {
            return m.call(observer, value);
        } catch (e) {
            closeCancelTokenObserver(this);
            throw e;
        }
    },
    throw(value) {
        // If the stream is closed, throw the error to the caller
        if (isCancelTokenObserverClosed(this)) {
            throw value;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        if (isCancelTokenObserver(this._observer)) {
            return this._observer.throw(value);
        }

        let m;
        if (!isCancel(value)) {
            m = getMethod(observer, "else");
            if (m) {
                return m.call(observer, value);
            }
        }

        m = getMethod(observer, "catch");
        if (m) {
            return m.call(observer, value);
        }
        else {
            throw value;
        }
    },
    else(value) {
        // If the stream is closed, throw the error to the caller
        if (isCancelTokenObserverClosed(this)) {
            throw value;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        let m = getMethod(observer, "else");

        if (m) {
            m.call(observer, value);
        }
        else {
            throw value;
        }
    },
    catch(value) {
        if (isSubscriptionCancel(value)) {
            return;
        }
        // If the stream is closed, throw the error to the caller
        if (isCancelTokenObserverClosed(this)) {
            throw value;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        let m = getMethod(observer, "catch");

        if (m) {
            return m.call(observer, value);
        }
        else {
            throw value;
        }
    },
    complete(value) {
        // If the stream if closed, then return undefined
        if (isCancelTokenObserverClosed(this)) {
            return undefined;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        let m = getMethod(observer, "complete");

        // If the sink does not support "complete", then return undefined
        value = m ? m.call(observer, value) : undefined;

        return value;

    }
});

export class Observable {
    // == Fundamental ==
    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(observer, token = new CancelToken(cancel => { })) {
        observer = new CancelTokenObserver(observer, token);

        this._subscriber(observer, token);
    }

    [Symbol.observable]() { return this }

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

            return new C((observer, token) => observable.subscribe(observer, token));
        }

        method = getMethod(x, Symbol.iterator);

        if (!method)
            throw new TypeError(x + " is not observable");

        return new C((observer, token) => {
            token.cancelled.then(observer.cancel.bind(observer));

            for (let item of method.call(x)) {
                if (token.reason) {
                    break;
                }
                try {
                    observer.next(item);
                }
                catch(e) {
                    return observer.throw(e);
                }
            }

            observer.complete();
        });
    }

    static of(...items) {
        let C = typeof this === "function" ? this : Observable;

        return new C((observer, token) => {
            for (let item of items) {
                if (token.reason) {
                    break;
                }
                try {
                    observer.next(item);
                }
                catch(e) {
                    return observer.throw(e);
                }
            }

            observer.complete();
        });
    }
}
