import { testMethodProperty } from "./helpers.js";

export default {

    "SubscriptionObserver.prototype has a cancel method" (test, { Observable }) {

        let observer;
        new Observable(x => { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "cancel", {
            configurable: true,
            writable: true,
            length: 0
        });
    },

    "Return value" (test, { Observable }) {

        new Observable(observer => {

            test._("Cancel returns undefined").equals(observer.cancel(), undefined);

        }).subscribe({});
    },

    "Cleanup functions" (test, { Observable }) {

        let observer, called = 0;

        let observable = new Observable(x => {
            observer = x;
            return _=> { called++ };
        });

        observable.subscribe({});
        observer.cancel();

        test._("Cleanup function is called by cancel")
        .equals(called, 1);

        observer.cancel();

        test._("Cleanup function is not called if cancel is called again")
        .equals(called, 1);

        called = 0;
        observable.subscribe({});
        observer.complete();
        observer.cancel();

        test._("Cleanup function is not called if cancel is called after complete")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error() {} });
        observer.error();
        observer.cancel();

        test._("Cleanup function is not called if cancel is called after error")
        .equals(called, 1);

        called = 0;
        new Observable(x => {
            observer = x;
            return _=> { called++; observer.cancel(); };
        }).subscribe({});

        observer.cancel();

        test._("Cleanup function is not called again if cancel is called during cleanup")
        .equals(called, 1);
    },

    "Stream is closed after calling cancel" (test, { Observable }) {

        let observer, called = 0;

        new Observable(x => { observer = x }).subscribe({
            next() { called++ },
            error() { called++ },
            complete() { called++ },
        });

        observer.cancel();

        observer.next();
        test._("Next does not forward after cancel").equals(called, 0);

        test
        ._("Error throws after cancel")
        .throws(_=> observer.error(new Error()));

        observer.complete();
        test._("Complete does not forward after cancel").equals(called, 0);

        test._("Closed property is true after cancel").equals(observer.closed, true);
    },

};
