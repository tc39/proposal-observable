import { testMethodProperty } from "./helpers.js";

export default {

    "SubscriptionObserver.prototype has an error method" (test, { Observable }) {

        let observer;
        new Observable(x => { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "error", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Input value" (test, { Observable }) {

        let token = {};

        new Observable(observer => {

            observer.error(token, 1, 2);

        }).subscribe({

            error(value, ...args) {
                test._("Input value is forwarded to the observer")
                .equals(value, token)
                ._("Additional arguments are not forwarded")
                .equals(args.length, 0);
            }

        });
    },

    "Return value" (test, { Observable }) {

        let token = {};

        new Observable(observer => {

            test._("Returns the value returned from the observer")
            .equals(observer.error(), token);

            test._("Throws the input when closed")
            .throws(_=> { observer.error(token) }, token);

        }).subscribe({
            error() { return token }
        });
    },

    "Method lookup" (test, { Observable }) {

        let observer,
            error = new Error(),
            observable = new Observable(x => { observer = x });

        observable.subscribe({});
        test._("If property does not exist, then error throws the input")
        .throws(_=> observer.error(error), error);

        observable.subscribe({ error: undefined });
        test._("If property is undefined, then error throws the input")
        .throws(_=> observer.error(error), error);

        observable.subscribe({ error: null });
        test._("If property is null, then error throws the input")
        .throws(_=> observer.error(error), error);

        observable.subscribe({ error: {} });
        test._("If property is not a function, then an error is thrown")
        .throws(_=> observer.error(), TypeError);

        let actual = {};
        observable.subscribe(actual);
        actual.error = (_=> 1);
        test._("Method is not accessed until error is called")
        .equals(observer.error(error), 1);

        let called = 0;
        observable.subscribe({
            get error() {
                called++;
                return function() {};
            }
        });
        observer.complete();
        try { observer.error(error) }
        catch (x) {}
        test._("Method is not accessed when subscription is closed")
        .equals(called, 0);

        called = 0;
        observable.subscribe({
            get error() {
                called++;
                return function() {};
            }
        });
        observer.error();
        test._("Property is only accessed once during a lookup")
        .equals(called, 1);

        called = 0;
        observable.subscribe({
            next() { called++ },
            get error() {
                called++;
                observer.next();
                return function() {};
            }
        });
        observer.error();
        test._("When method lookup occurs, subscription is closed")
        .equals(called, 1);

    },

    "Cleanup functions" (test, { Observable }) {

        let called, observer;

        let observable = new Observable(x => {
            observer = x;
            return _=> { called++ };
        });

        called = 0;
        observable.subscribe({});
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when observer does not have an error method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error() { return 1 } });
        observer.error();
        test._("Cleanup function is called when observer has an error method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ get error() { throw new Error() } });
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when method lookup throws")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error() { throw new Error() } });
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when method throws")
        .equals(called, 1);

        let error = new Error(), caught = null;

        new Observable(x => {
            observer = x;
            return _=> { throw new Error() };
        }).subscribe({ error() { throw error } });

        try { observer.error() }
        catch (x) { caught = x }

        test._("If both error and the cleanup function throw, then the error " +
            "from the error method is thrown")
        .assert(caught === error);

    },

};
