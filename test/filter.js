/*

Not currently part of the es-observable specification

*/

import { testMethodProperty, getSymbol } from "./helpers.js";

export default {

    "Observable.prototype has a filter property" (test, { Observable }) {

        testMethodProperty(test, Observable.prototype, "filter", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Allowed arguments" (test, { Observable }) {

        let observable = new Observable(_=> null);

        test._("Argument must be a function")
        .throws(_=> observable.filter(), TypeError)
        .throws(_=> observable.filter(null), TypeError)
        .throws(_=> observable.filter({}), TypeError)
        ;
    },

    "Species is used to determine the constructor" (test, { Observable }) {

        let observable = new Observable(_=> null),
            token = {};

        function species() {
            this.token = token;
        }

        observable.constructor = function() {};
        observable.constructor[getSymbol("species")] = species;

        test._("Constructor species is used as the new constructor")
        .equals(observable.filter(_=> {}).token, token);

        observable.constructor[getSymbol("species")] = null;
        test._("An error is thrown if instance does not have a constructor species")
        .throws(_=> observable.filter(_=> {}), TypeError);

        observable.constructor = null;
        test._("An error is thrown if the instance does not have a constructor")
        .throws(_=> observable.filter(_=> {}), TypeError);
    },

    "The callback is used to filter next values" (test, { Observable }) {

        let values = [],
            returns = [];

        new Observable(observer => {
            returns.push(observer.next(1));
            returns.push(observer.next(2));
            returns.push(observer.next(3));
            returns.push(observer.next(4));
            observer.complete();
        }).filter(x => x % 2).subscribe({
            next(v) { values.push(v); return -v; }
        });

        test
        ._("Filtered values are sent to the observer")
        .equals(values, [1, 3])
        ._("Return values from the observer are returned to the caller")
        .equals(returns, [-1, undefined, -3, undefined])
        ;
    },

    "Errors thrown from the callback are sent to the observer" (test, { Observable }) {

        let error = new Error(),
            thrown = null,
            returned = null,
            token = {};

        new Observable(observer => {
            returned = observer.next(1);
        }).filter(x => { throw error }).subscribe({
            error(e) { thrown = e; return token; }
        });

        test
        ._("Exceptions from callback are sent to the observer")
        .equals(thrown, error)
        ._("The result of calling error is returned to the caller")
        .equals(returned, token)
        ;
    },

    "Errors are forwarded to the observer" (test, { Observable }) {

        let error = new Error(),
            thrown = null,
            returned = null,
            token = {};

        new Observable(observer => {
            returned = observer.error(error);
        }).filter(x => true).subscribe({
            error(e) { thrown = e; return token; }
        });

        test
        ._("Error values are forwarded")
        .equals(thrown, error)
        ._("The return value of the error method is returned to the caller")
        .equals(returned, token)
        ;
    },

    "Complete is forwarded to the observer" (test, { Observable }) {

        let arg = {},
            passed = null,
            returned = null,
            token = {};

        new Observable(observer => {
            returned = observer.complete(arg);
        }).filter(x => true).subscribe({
            complete(v) { passed = v; return token; }
        });

        test
        ._("Complete values are forwarded")
        .equals(passed, arg)
        ._("The return value of the complete method is returned to the caller")
        .equals(returned, token)
        ;
    },

};
