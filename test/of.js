import { testMethodProperty } from "./helpers.js";

export default {

    "Observable has an of property" (test, { Observable }) {

        testMethodProperty(test, Observable, "of", {
            configurable: true,
            writable: true,
            length: 0,
        });
    },

    "Uses the this value if it's a function" (test, { Observable }) {

        let usesThis = false;

        Observable.of.call(_=> usesThis = true);
        test._("Observable.of will use the 'this' value if it is callable")
        .equals(usesThis, true);
    },

    "Uses 'Observable' if the 'this' value is not a function" (test, { Observable }) {

        let result = Observable.of.call({}, 1, 2, 3, 4);

        test._("Observable.of will use 'Observable' if the this value is not callable")
        .assert(result instanceof Observable);
    },

    "Arguments are delivered to next" (test, { Observable }) {

        return new Promise(resolve => {

            let values = [],
                turns = 0;

            Promise.resolve().then(_=> turns++);

            Observable.of(1, 2, 3, 4).subscribe({

                next(v) {
                    values.push(v);
                    Promise.resolve().then(_=> turns++);
                },

                complete() {
                    test._("All items are delivered and complete is called")
                    .equals(values, [1, 2, 3, 4]);
                    test._("Items are delivered in a single future turn")
                    .equals(turns, 1);

                    resolve();
                },
            });

        });
    },

    "Responds to cancellation from next" (test, { Observable }) {

        return new Promise(resolve => {

            let values = [];

            let cancel = Observable.of(1, 2, 3, 4).subscribe({

                next(v) {

                    values.push(v);
                    cancel();
                    Promise.resolve().then(_=> {
                        test._("Cancelling from next stops observation")
                        .equals(values, [1]);
                        resolve();
                    });
                }
            });
        });
    },

    "Responds to cancellation before next is called" (test, { Observable }) {

        return new Promise(resolve => {

            let values = [];

            let cancel = Observable.of(1, 2, 3, 4).subscribe({
                next(v) { values.push(v) }
            });

            cancel();

            Promise.resolve().then(_=> {
                test._("Cancelling before next is called stops observation")
                .equals(values, []);
                resolve();
            });
        });
    },

};
