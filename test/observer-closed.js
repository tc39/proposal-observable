import { testMethodProperty } from "./helpers.js";

export default {

    "SubscriptionObserver.prototype has a closed property" (test, { Observable }) {

        let observer;
        new Observable(x => { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "closed", {
            get: true,
            configurable: true,
        });
    },

    "Closed property is false when subscription is active" (test, { Observable }) {

        let observer;
        new Observable(x => {

            observer = x;

            test._("Closed is false during subscription")
            .equals(observer.closed, false);

            observer.next();

            test._("Closed is false after sending next")
            .equals(observer.closed, false);

        }).subscribe({});

        test._("Closed is false after subscription")
        .equals(observer.closed, false);
    },

    "Closed property is true when subscription is closed" (test, { Observable }) {

        let sink = { error() {} };

        new Observable(observer => {

            observer.complete();
            test._("Closed is true after calling complete")
            .equals(observer.closed, true);

        }).subscribe(sink);

        new Observable(observer => {

            observer.error(null);
            test._("Closed is true after calling error")
            .equals(observer.closed, true);

        }).subscribe(sink);
    },

};
