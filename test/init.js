import { runTests } from "moon-unit";
import { Observable } from "../src/Observable.js";

runTests({

    "Cancellation functions": {

        async "Allowed return values" (test) {

            let type = "";

            let sink = {
                next(v) {},
                throw(v) {},
                return(v) {},
            };

            test
            ._("Undefined can be returned")
            .not().throws(_=> new Observable(sink => undefined)[Symbol.observer](sink))
            ._("Null can be returned")
            .not().throws(_=> new Observable(sink => null)[Symbol.observer](sink))
            ._("Functions can be returned")
            .not().throws(_=> new Observable(sink => function() {})[Symbol.observer](sink))
            ._("Objects can be returned")
            .not().throws(_=> new Observable(sink => {})[Symbol.observer](sink))
            ._("Non-functions can be returned")
            .not().throws(_=> new Observable(sink => 0)[Symbol.observer](sink))
            .not().throws(_=> new Observable(sink => false)[Symbol.observer](sink))
            ;
        },


        "Call invariants" (test) {

            let called = 0,
                returned = 0;

            let subscription = new Observable(sink => {
                return _=> { called++ };
            })[Symbol.observer]({
                next(v) {},
                return(v) { returned++ },
            });

            subscription.unsubscribe();

            test._("The stop function is called when unsubscribing")
            .equals(called, 1);

            subscription.unsubscribe();

            test._("The stop function is called again when unsubscribe is called again")
            .equals(called, 2);

            test._("The return method of the sink is not automatically called")
            .equals(returned, 0);

            called = 0;

            new Observable(sink => {
                sink.next(1);
                return _=> { called++ };
            })[Symbol.observer]({
                next(v) { return { done: true } },
            });

            test._("The stop function is called when the sink returns a done result")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.throw(1);
                return _=> { called++ };
            })[Symbol.observer]({
                next(v) {},
                throw(v) {},
            });

            test._("The stop function is called when an error is sent to the sink")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.return(1);
                return _=> { called++ };
            })[Symbol.observer]({
                next(v) {},
                return(v) {},
            });

            test._("The stop function is called when a return is sent to the sink")
            .equals(called, 1);

        },


        "Default stop behavior" (test) {

            let subscription;

            let sink = {

                called: 0,
                next(v) {},
                throw(v) {},
                return(v) { this.called++ },
            };

            subscription = new Observable(sink => {})[Symbol.observer](sink);
            subscription.unsubscribe();

            test
            ._("The default stop function calls return on the underlying sink")
            .equals(sink.called, 1);

            sink.called = 0;
            subscription = new Observable(sink => null)[Symbol.observer](sink);
            subscription.unsubscribe();

            test
            ._("The default stop function is used when the return value is null")
            .equals(sink.called, 1);

            subscription.unsubscribe();

            test
            ._("Return is not called on the underlying sink more than once")
            .equals(sink.called, 1);
        },

    }

});
