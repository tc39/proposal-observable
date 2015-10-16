import { testMethodProperty } from "./helpers.js";

export default {

    "SubscriptionObserver.prototype has an unsubscribe method" (test, { Observable }) {

        let observer;
        new Observable(x => { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "unsubscribe", {
            configurable: true,
            writable: true,
            length: 0
        });
    },

    "Return value" (test, { Observable }) {

        new Observable(observer => {

            test._("Cancel returns undefined").equals(observer.unsubscribe(), undefined);

        }).subscribe({});
    },

    "Cleanup functions" (test, { Observable }) {

        let observer, called = 0;

        let observable = new Observable(x => {
            observer = x;
            return _=> { called++ };
        });

        observable.subscribe({});
        observer.unsubscribe();

        test._("Cleanup function is called by unsubscribe")
        .equals(called, 1);

        observer.unsubscribe();

        test._("Cleanup function is not called if unsubscribe is called again")
        .equals(called, 1);

        called = 0;
        observable.subscribe({});
        observer.complete();
        observer.unsubscribe();

        test._("Cleanup function is not called if unsubscribe is called after complete")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error() {} });
        observer.error();
        observer.unsubscribe();

        test._("Cleanup function is not called if unsubscribe is called after error")
        .equals(called, 1);

        called = 0;
        new Observable(x => {
            observer = x;
            return _=> { called++; observer.unsubscribe(); };
        }).subscribe({});

        observer.unsubscribe();

        test._("Cleanup function is not called again if unsubscribe is called during cleanup")
        .equals(called, 1);
    },

    "Stream is closed after calling unsubscribe" (test, { Observable }) {

        let observer, called = 0;

        new Observable(x => { observer = x }).subscribe({
            next() { called++ },
            error() { called++ },
            complete() { called++ },
        });

        observer.unsubscribe();

        observer.next();
        test._("Next does not forward after unsubscribe").equals(called, 0);

        test
        ._("Error throws after unsubscribe")
        .throws(_=> observer.error(new Error()));

        observer.complete();
        test._("Complete does not forward after unsubscribe").equals(called, 0);

        test._("Closed property is true after unsubscribe").equals(observer.closed, true);
    },

};
