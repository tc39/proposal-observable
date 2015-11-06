/*

Not currently part of the es-observable specification

*/

import { testMethodProperty, getSymbol } from "./helpers.js";

export default {

    "Observable.prototype has a map property" (test, { Observable }) {

        testMethodProperty(test, Observable.prototype, "map", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Allowed arguments" (test, { Observable }) {

        let observable = new Observable(_=> null);

        test._("Argument must be a function")
        .throws(_=> observable.map(), TypeError)
        .throws(_=> observable.map(null), TypeError)
        .throws(_=> observable.map({}), TypeError)
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
        .equals(observable.map(_=> {}).token, token);

        observable.constructor[getSymbol("species")] = null;
        test._("An error is thrown if instance does not have a constructor species")
        .throws(_=> observable.map(_=> {}), TypeError);

        observable.constructor = null;
        test._("An error is thrown if the instance does not have a constructor")
        .throws(_=> observable.map(_=> {}), TypeError);
    },

    "The callback is used to map next values" (test, { Observable }) {

        let values = [],
            returns = [];

        new Observable(observer => {
            returns.push(observer.next(1));
            returns.push(observer.next(2));
            observer.complete();
        }).map(x => x * 2).subscribe({
            next(v) { values.push(v); return -v; }
        });

        test
        ._("Mapped values are sent to the observer")
        .equals(values, [2, 4])
        ._("Return values from the observer are returned to the caller")
        .equals(returns, [-2, -4])
        ;
    },

    "Errors thrown from the callback are sent to the observer" (test, { Observable }) {

        let error = new Error(),
            thrown = null,
            returned = null,
            token = {};

        new Observable(observer => {
            returned = observer.next(1);
        }).map(x => { throw error }).subscribe({
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
        }).map(x => x).subscribe({
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
        }).map(x => x).subscribe({
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
