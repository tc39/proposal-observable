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

    "Subscribe is called on the 'this' value" (test, { Observable }) {

        let called = 0,
            observer = null;

        Observable.prototype.forEach.call({

            subscribe(x) {
                called++;
                observer = x;
            }

        }, _=> null);

        test._("The subscribe method is called with an observer")
        .equals(called, 1)
        .equals(typeof observer, "object")
        .equals(typeof observer.next, "function")
        ;
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

    "The callback is called in the next turn when next is called synchronously" (test, { Observable }) {

        let list = [];

        return new Observable(observer => {

            Promise.resolve().then(_=> list.push(3));
            list.push(1);
            observer.next();
            Promise.resolve().then(_=> list.push(5));
            list.push(2);
            observer.complete();

        }).forEach(x => {

            list.push(4);

        }).then(_=> {

            test._("The callback is called in the next turn")
            .equals(list, [1, 2, 3, 4, 5]);
        });
    },

    "The callback is called immediately if initialization is complete" (test, { Observable }) {

        let list = [];

        return new Observable(observer => {

            setTimeout(_=> {
                Promise.resolve().then(_=> list.push(4));
                list.push(1);
                observer.next();
                list.push(3);
                observer.complete();
            }, 0);

        }).forEach(x => {

            list.push(2);

        }).then(_=> {

            test._("The callback is called immediately")
            .equals(list, [1, 2, 3, 4]);
        });
    },

    "The next value is queued if the callback is executing" (test, { Observable }) {

        let list = [], next;

        return new Observable(observer => {

            next = observer.next.bind(observer);

            setTimeout(_=> {
                observer.next();
                observer.complete();
            }, 0);

        }).forEach(x => {

            list.push(1);
            Promise.resolve().then(_=> list.push(3));
            next();
            list.push(2);

        }).then(_=> {

            test._("The next value is delivered in a future turn")
            .equals(list, [1, 2, 3, 1, 2, 3]);
        });
    }

};
