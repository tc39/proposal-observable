import { testMethodProperty, job } from "./helpers.js";

export default {

    "SubscriptionObserver.prototype has a complete method" (test, { Observable }) {

        let observer;
        new Observable(x => { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "complete", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Initialization" (test, { Observable }) {

        test._("Throws an error if subscription initialization is not complete")
        .throws(_=> {
            new Observable(observer => { observer.complete(1) }).subscribe({});
        });
    },

    "Input value" (test, { Observable }) {

        return new Promise(resolve => {

            let token = {};

            new Observable(observer => job(_=> observer.complete(token, 1, 2))).subscribe({

                complete(value, ...args) {

                    resolve();

                    test._("Input value is forwarded to the observer")
                    .equals(value, token)
                    ._("Additional arguments are not forwarded")
                    .equals(args.length, 0);
                }

            });
        });
    },

    "Return value" (test, { Observable }) {

        return new Promise(resolve => {

            let token = {};

            new Observable(observer => job(_=> {

                test._("Returns the value returned from the observer")
                .equals(observer.complete(), token);

                test._("Returns undefined when closed")
                .equals(observer.complete(), undefined);

                resolve();

            })).subscribe({
                complete() { return token }
            });
        });
    },

    "Method lookup" (test, { Observable }) {

        let observer,
            observable = new Observable(x => { observer = x });

        observable.subscribe({});
        test._("If property does not exist, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: undefined });
        test._("If property is undefined, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: null });
        test._("If property is null, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: {} });
        test._("If property is not a function, then an error is thrown")
        .throws(_=> observer.complete(), TypeError);

        let actual = {};
        observable.subscribe(actual);
        actual.complete = (_=> 1);
        test._("Method is not accessed until complete is called")
        .equals(observer.complete(), 1);

        let called = 0;
        observable.subscribe({
            get complete() {
                called++;
                return function() {};
            },
            error() {},
        });
        observer.error(new Error());
        observer.complete();
        test._("Method is not accessed when subscription is closed")
        .equals(called, 0);

        called = 0;
        observable.subscribe({
            get complete() {
                called++;
                return function() {};
            }
        });
        observer.complete();
        test._("Property is only accessed once during a lookup")
        .equals(called, 1);

        called = 0;
        observable.subscribe({
            next() { called++ },
            get complete() {
                called++;
                observer.next();
                return function() { return 1 };
            }
        });
        observer.complete();
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
        observer.complete();
        test._("Cleanup function is called when observer does not have a complete method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ complete() { return 1 } });
        observer.complete();
        test._("Cleanup function is called when observer has a complete method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ get complete() { throw new Error() } });
        try { observer.complete() }
        catch (x) {}
        test._("Cleanup function is called when method lookup throws")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ complete() { throw new Error() } });
        try { observer.complete() }
        catch (x) {}
        test._("Cleanup function is called when method throws")
        .equals(called, 1);

        let error = new Error(), caught = null;

        new Observable(x => {
            observer = x;
            return _=> { throw new Error() };
        }).subscribe({ complete() { throw error } });

        try { observer.complete() }
        catch (x) { caught = x }

        test._("If both complete and the cleanup function throw, then the error " +
            "from the complete method is thrown")
        .assert(caught === error);

    },

};
