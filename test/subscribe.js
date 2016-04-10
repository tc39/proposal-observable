import { testMethodProperty, job } from "./helpers.js";

export default {

    "Observable.prototype has a subscribe property" (test, { Observable }) {

        testMethodProperty(test, Observable.prototype, "subscribe", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Argument type" (test, { Observable }) {

        let x = new Observable(sink => null);

        test
        ._("Throws if observer is not an object")
        .throws(_=> x.subscribe(null), TypeError)
        .throws(_=> x.subscribe(undefined), TypeError)
        .throws(_=> x.subscribe(1), TypeError)
        .throws(_=> x.subscribe(true), TypeError)
        .throws(_=> x.subscribe("string"), TypeError)

        ._("Any object may be an observer")
        .not().throws(_=> x.subscribe({}))
        .not().throws(_=> x.subscribe(Object(1)))
        .not().throws(_=> x.subscribe(function() {}))
        ;
    },

    "Subscriber arguments" (test, { Observable }) {

        let observer = null;
        new Observable(x => { observer = x }).subscribe({});

        test._("Subscriber is called with an observer")
        .equals(typeof observer, "object")
        .equals(typeof observer.next, "function")
        .equals(typeof observer.error, "function")
        .equals(typeof observer.complete, "function")
        ;

        test._("Subscription observer's constructor property is Object")
        .equals(observer.constructor, Object);
    },

    "Subscriber return types" (test, { Observable }) {

        let type = "", sink = {};

        test
        ._("Undefined can be returned")
        .not().throws(_=> new Observable(sink => undefined).subscribe(sink))
        ._("Null can be returned")
        .not().throws(_=> new Observable(sink => null).subscribe(sink))
        ._("Functions can be returned")
        .not().throws(_=> new Observable(sink => function() {}).subscribe(sink))
        ._("Subscriptions can be returned")
        .not().throws(_=> new Observable(sink => ({ unsubscribe() {} }).subscribe(sink)))
        ._("Non callable, non-subscription objects cannot be returned")
        .throws(_=> new Observable(sink => ({})).subscribe(sink), TypeError)
        ._("Non-functions cannot be returned")
        .throws(_=> new Observable(sink => 0).subscribe(sink), TypeError)
        .throws(_=> new Observable(sink => false).subscribe(sink), TypeError)
        ;
    },

    "Returns a subscription object" (test, { Observable }) {

        let called = 0;
        let subscription = new Observable(observer => {
            return _=> called++;
        }).subscribe({});

        let proto = Object.getPrototypeOf(subscription);

        test
        ._("Subscribe returns an object")
        .equals(typeof subscription, "object")
        ._("Subscriptions have an unsubscribe method")
        .equals(typeof subscription.unsubscribe, "function")
        ._("Contructor property is Object")
        .equals(subscription.constructor, Object)
        ._("Unsubscribe is defined on the prototype object")
        .equals(subscription.unsubscribe, proto.unsubscribe)
        ._("Unsubscribe returns undefined")
        .equals(subscription.unsubscribe(), undefined)
        ._("Unsubscribe calls the cleanup function")
        .equals(called, 1)
        ;
    },

    "Cleanup function" (test, { Observable }) {

        let called = 0,
            returned = 0;

        let subscription = new Observable(sink => {
            return _=> { called++ };
        }).subscribe({
            complete() { returned++ },
        });

        subscription.unsubscribe();

        test._("The cleanup function is called when unsubscribing")
        .equals(called, 1);

        subscription.unsubscribe();

        test._("The cleanup function is not called again when unsubscribe is called again")
        .equals(called, 1);

        let unsubscribeArgs = null;
        called = 0;

        subscription = new Observable(sink => {
            return {
                unsubscribe(...args) {
                    called = 1;
                    unsubscribeArgs = args;
                }
            };
        }).subscribe({
            next() {},
        });

        subscription.unsubscribe(1);
        test._("If a subscription is returned, then unsubscribe is called on cleanup")
        .equals(called, 1)
        ._("Arguments are not forwarded to the unsubscribe function")
        .equals(unsubscribeArgs, []);
    },

    "Cleanup function and errors" (test, { Observable }) {

        let called = 0;

        return new Promise((resolve, reject) => {

            new Observable(sink => {
                job(_=> sink.error(1));
                return _=> { called++ };
            }).subscribe({
                error: resolve,
                complete: reject,
            });

        }).then(_=> {

            test._("The cleanup function is called when an error is sent to the sink")
            .equals(called, 1);
        });
    },

    "Cleanup function and complete" (test, { Observable }) {

        let called = 0;

        return new Promise((resolve, reject) => {

            new Observable(sink => {
                job(_=> sink.complete(1));
                return _=> { called++ };
            }).subscribe({
                error: reject,
                complete: resolve
            });

        }).then(_=> {

            test._("The cleanup function is called when a complete is sent to the sink")
            .equals(called, 1);
        });
    },

    "Exceptions thrown from the subscriber" (test, { Observable }) {

        let error = new Error(),
            observable = new Observable(_=> { throw error });

        test._("Subscribe throws if the subscriber function throws")
        .throws(_=> observable.subscribe({}), error);

        test._("Subscribe does not send the error to the observer")
        .throws(_=> observable.subscribe({ error(e) {} }));
    },

};
