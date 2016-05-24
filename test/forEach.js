import { testMethodProperty } from "./helpers.js";

export default {

    "Observable.prototype has a forEach property" (test, { Observable }) {

        testMethodProperty(test, Observable.prototype, "forEach", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Argument must be a function" (test, { Observable }) {

        let result = Observable.prototype.forEach.call({}, {});

        test._("If the first argument is not a function, a promise is returned")
        .assert(result instanceof Promise);

        return result.then(_=> null, e => e).then(error => {

            test._("The promise is rejected with a TypeError")
            .assert(Boolean(error))
            .assert(error instanceof TypeError);
        });
    },

    "Subscribe is called asynchronously" (test, { Observable }) {
        let observer = null,
            list = [];

        Promise.resolve().then(_=> list.push(1));

        let promise = Observable.prototype.forEach.call({

            subscribe(x) {
                list.push(2);
                x.complete();
            }

        }, _=> null).then(_=> {

            test._("Subscribe is called in a job").equals(list, [1, 2]);
        });

        test._("Subscribe is not called synchronously").equals(list, []);
        return promise;
    },

    "Subscribe is called on the 'this' value" (test, { Observable }) {

        let observer = null,
            called = 0;

        return Observable.prototype.forEach.call({

            subscribe(x) {
                called++;
                observer = x;
                x.complete();
            }

        }, _=> null).then(_=> {

            test._("The subscribe method is called with an observer")
            .equals(called, 1)
            .equals(typeof observer, "object")
            .equals(typeof observer.next, "function")
            ;
        });
    },

    "Error rejects the promise" (test, { Observable }) {

        let error = new Error();

        return new Observable(observer => { observer.error(error) })
            .forEach(_=> null)
            .then(_=> null, e => e)
            .then(value => {
                test._("Sending error rejects the promise with the supplied value")
                .equals(value, error);
            });
    },

    "Complete resolves the promise" (test, { Observable }) {

        let token = {};

        return new Observable(observer => { observer.complete(token) })
            .forEach(_=> null)
            .then(x => x, e => null)
            .then(value => {
                test._("Sending complete resolves the promise with the supplied value")
                .equals(value, token);
            });
    },

    "The callback is called with the next value" (test, { Observable }) {

        let values = [], thisArg;

        return new Observable(observer => {

            observer.next(1);
            observer.next(2);
            observer.next(3);
            observer.complete();

        }).forEach(function(x) {

            thisArg = this;
            values.push(x);

        }).then(_=> {

            test
            ._("The callback receives each next value")
            .equals(values, [1, 2, 3])
            ._("The callback receives undefined as the this value")
            .equals(thisArg, undefined);

        });
    },

    "If the callback throws an error, the promise is rejected" (test, { Observable }) {

        let error = new Error();

        return new Observable(observer => { observer.next(1) })
            .forEach(_=> { throw error })
            .then(_=> null, e => e)
            .then(value => {
                test._("The promise is rejected with the thrown value")
                .equals(value, error);
            });
    },

    "If the callback throws an error, the callback function is not called again" (test, { Observable }) {

        let callCount = 0;

        return new Observable(observer => {

            observer.next(1);
            observer.next(2);
            observer.next(3);

        }).forEach(x => {

            callCount++;
            throw new Error();

        }).catch(x => {

            test._("The callback is not called again after throwing an error")
            .equals(callCount, 1);
        });
    },

};
