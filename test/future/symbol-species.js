import { testMethodProperty, getSymbol } from "./helpers.js";

export default {

    "Observable has a species method" (test, { Observable }) {

        testMethodProperty(test, Observable, getSymbol("species"), {
            get: true,
            configurable: true
        });
    },

    "Return value" (test, { Observable }) {

        let desc = Object.getOwnPropertyDescriptor(Observable, getSymbol("species")),
            thisVal = {};

        test._("Returns the 'this' value").equals(desc.get.call(thisVal), thisVal);
    }

};
