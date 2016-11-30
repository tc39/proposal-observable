import CancelToken from './CancelToken';
import Cancel from './Cancel';

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

function isCancelTokenObserverSelfCancelled(cancelTokenObserver, cancel) {
    return cancelTokenObserver._subscriptionCancel === cancel;
}

function isCancelTokenObserverTokenCancelled(cancelTokenObserver) {
    return cancelTokenObserver._token.reason !== undefined;
}

function isCancelTokenObserverClosed(cancelTokenObserver) {
    return cancelTokenObserver._closed;
}

function getCancelTokenObserverToken(cancelTokenObserver) {
    return cancelTokenObserver._token;
}

function isCancelTokenObserver(maybeCancelTokenObserver) {
    return maybeCancelTokenObserver instanceof CancelTokenObserver;
}

function closeCancelTokenObserver(cancelTokenObserver) {
    cancelTokenObserver._closed = true;
    cancelTokenObserver._observer = undefined;
    cancelTokenObserver._subscriptionCancel = new Cancel("Subscription canceled.");
    cancelTokenObserver._cancel(cancelTokenObserver._subscriptionCancel);
}

function CancelTokenObserver(observer, token, cancel) {
    this._observer = observer;
    this._token = token;
    this._cancel = cancel;
}

function isCancel(maybeCancel) {
    return maybeCancel instanceof Cancel;
}

CancelTokenObserver.prototype = nonEnum({
    next(value) {
        // If the stream if closed, then return undefined
        if (isCancelTokenObserverTokenCancelled(this)) {
            return;
        }

        let observer = this._observer;
        let m = getMethod(observer, "next");

        // If the observer doesn't support "next", then return undefined
        if (!m)
            return;

        // Send the next value to the sink
        try {
            m.call(observer, value);
        } catch (e) {
            // HostReportErrors(e)
        }
    },
    throw(value) {
        let m,
            observer = this._observer,
            isCTObserver;

        isCTObserver = isCancelTokenObserver(observer);

        if (!isCancel(value)) {
            if (isCTObserver) {
                m = observer.throw;
            }
            else {
                m = getMethod(observer, "else");
            }
            if (m) {
                if (isCancelTokenObserverTokenCancelled(this)) {
                  return;
                }

                closeCancelTokenObserver(this);

                try {
                    m.call(observer, value);
                }
                catch(e) {
                    // HostReportErrors(e)
                    return;
                }
            }
        }

        if (isCTObserver) {
            m = observer.throw;
        }
        else {
            m = getMethod(observer, "catch");
        }

        if (m) {
            // If the stream was closed internally, or the observer is closed, noop
            if (isCancelTokenObserverClosed(this)) {
                return;
            }

            closeCancelTokenObserver(this);

            try {
                m.call(observer, value);
            }
            catch(e) {
                // HostReportErrors(e)
            }
        }
    },
    else(value) {
        // if token is cancelled, noop
        if (isCancelTokenObserverTokenCancelled(this)) {
            return;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        let m = getMethod(observer, "else");

        if (m) {
            try {
                m.call(observer, value);
            }
            catch(e) {
                // HostReportErrors(e)
            }
        }
        else {
            // HostReportErrors(value);
        }
    },
    catch(value) {
        // If the subscription was closed internally, or the observer
        // has already been closed, then its a noop
        if (isCancelTokenObserverSelfCancelled(this, value) || isCancelTokenObserverClosed(this)) {
            return;
        }

        let observer = this._observer;
        closeCancelTokenObserver(this);

        let m = getMethod(observer, "catch");

        if (m) {
            try {
                m.call(observer, value);
            }
            catch(e) {
                // HostReportErrors(e)
            }
        }
        else {
            // HostReportErrors(value)
        }
    },
    complete(value) {
        // if token is cancelled, noop
        if (isCancelTokenObserverTokenCancelled(this)) {
            return;
        }

        let observer = this._observer;
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
});

export class Observable {
    // == Fundamental ==
    constructor(subscriber) {
        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(observer, outerToken) {
        let token;
        if (Object(observer) !== observer) {
            throw new TypeError(observer + " is not a object");
        }

        if (outerToken != null && Object(outerToken) !== outerToken) {
            throw new TypeError(outerToken + " is not an object");
        }

        const { token: innerToken, cancel } = CancelToken.source();
        token = outerToken != null ? CancelToken.race([outerToken, innerToken]) : innerToken;

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

    forEach(next, outerToken) {
        const self = this;
        let token;
        // The next argument must be a function
        if (typeof next !== "function") {
            throw new TypeError(next + " is not a function(…)");
        }

        if (outerToken != null && Object(outerToken) !== outerToken) {
            throw new TypeError(outerToken + " is not an object");
        }

        return new Promise((accept, reject) => {
            // schedule subscription logic
            Promise.resolve().then(() => {
                const self = this;
                let index = 0;
                const { token: innerToken, cancel } = CancelToken.source();
                token = outerToken != null ? CancelToken.race([outerToken, innerToken]) : innerToken;

                this.subscribe(
                    {
                        next(value) {
                            try {
                                next(value, index++, self);
                            }
                            catch(e) {
                                cancel(new Cancel("Subscription canceled due to observer error."));
                                reject(e);
                            }
                        },
                        catch(e) {
                            reject(e);
                        },
                        complete(value) {
                            // suppress return value
                            accept();
                        }
                    },
                    token);
            });
        });
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
            throw new TypeError(x + " is not iterable");

        return new C((observer, token) => {
            for (let item of method.call(x)) {
                if (token.reason) {
                    return;
                }

                observer.next(item);
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
                    observer.throw(e);
                }
            }

            observer.complete();
        });
    }
}
