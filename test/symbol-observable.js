import { testMethodProperty } from "./helpers.js";

export default {

    "Observable.prototype has a Symbol.observable method" (test, { Observable }) {

        test._("Symbol.observable exists").assert(Symbol.observable);

        testMethodProperty(test, Observable.prototype, Symbol.observable, {
            configurable: true,
            writable: true,
            length: 0
        });
    },

    "Return value" (test, { Observable }) {

        let desc = Object.getOwnPropertyDescriptor(Observable.prototype, Symbol.observable),
            thisVal = {};

        test._("Returns the 'this' value").equals(desc.value.call(thisVal), thisVal);
    }

};
