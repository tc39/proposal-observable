import { testMethodProperty } from "./helpers.js";

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
        ._("Objects cannot be returned")
        .throws(_=> new Observable(sink => ({})).subscribe(sink), TypeError)
        ._("Non-functions can be returned")
        .throws(_=> new Observable(sink => 0).subscribe(sink), TypeError)
        .throws(_=> new Observable(sink => false).subscribe(sink), TypeError)
        ;
    },

    "Returns a cancel function" (test, { Observable }) {

        let called = 0;
        let cancel = new Observable(observer => {
            return _=> called++;
        }).subscribe({});

        test
        ._("Subscribe returns a function")
        .equals(typeof cancel, "function")
        ._("Cancel returns undefined")
        .equals(cancel(), undefined)
        ._("Cancel calls the cleanup function")
        .equals(called, 1)
        ;
    },

    "Cleanup function" (test, { Observable }) {

        let called = 0,
            returned = 0;

        let unsubscribe = new Observable(sink => {
            return _=> { called++ };
        }).subscribe({
            complete(v) { returned++ },
        });

        unsubscribe();

        test._("The cleanup function is called when unsubscribing")
        .equals(called, 1);

        unsubscribe();

        test._("The cleanup function is not called again when unsubscribe is called again")
        .equals(called, 1);

        called = 0;

        new Observable(sink => {
            sink.error(1);
            return _=> { called++ };
        }).subscribe({
            error(v) {},
        });

        test._("The cleanup function is called when an error is sent to the sink")
        .equals(called, 1);

        called = 0;

        new Observable(sink => {
            sink.complete(1);
            return _=> { called++ };
        }).subscribe({
            complete(v) {},
        });

        test._("The cleanup function is called when a complete is sent to the sink")
        .equals(called, 1);

    },

    "Exceptions thrown from the subscriber" (test, { Observable }) {

        let error = new Error(),
            observable = new Observable(_=> { throw error });

        test._("Subscribe throws if the observer does not handle errors")
        .throws(_=> observable.subscribe({}), error);

        let thrown = null;
        observable.subscribe({ error(e) { thrown = e } });

        test._("Subscribe sends an error to the observer")
        .equals(thrown, error);
    },

};
