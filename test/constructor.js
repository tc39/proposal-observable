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

    "Subscriber function is not called by constructor" (test, { Observable }) {

        let called = 0;
        new Observable(_=> called++);

        test
        ._("The constructor does not call the subscriber function")
        .equals(called, 0)
        ;
    },

};
