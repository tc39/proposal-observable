import { testMethodProperty } from "./helpers.js";

export default {

    "Argument types" (test, { Observable }) {

        test
        ._("The first argument cannot be a non-callable object")
        .throws(_=> new Observable({}), TypeError)
        ._("The first argument cannot be a primative value")
        .throws(_=> new Observable(false), TypeError)
        .throws(_=> new Observable(null), TypeError)
        .throws(_=> new Observable(undefined), TypeError)
        .throws(_=> new Observable(1), TypeError)
        ._("The first argument can be a function")
        .not().throws(_=> new Observable(function() {}))
        ;
    },

    "Observable.prototype has a constructor property" (test, { Observable }) {

        testMethodProperty(test, Observable.prototype, "constructor", {
            configurable: true,
            writable: true,
            length: 1,
        });

        test._("Observable.prototype.constructor === Observable")
        .equals(Observable.prototype.constructor, Observable);
    },

    "Subscriber function is not called by constructor" (test, { Observable }) {

        let called = 0;
        new Observable(_=> called++);

        test
        ._("The constructor does not call the subscriber function")
        .equals(called, 0)
        ;
    },

};
