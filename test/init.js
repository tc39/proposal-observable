import { runTests } from "moon-unit";
import { Observable } from "../src/Observable.js";

runTests({

    "Cancellation functions": {

        async "Allowed return values" (test) {

            let type = "";

            let sink = {
                next(v) {},
                error(v) {},
                complete(v) {},
            };

            test
            ._("Undefined can be returned")
            .not().throws(_=> new Observable(sink => undefined).subscribe(sink))
            ._("Null can be returned")
            .not().throws(_=> new Observable(sink => null).subscribe(sink))
            ._("Functions can be returned")
            .not().throws(_=> new Observable(sink => function() {}).subscribe(sink))
            ._("Objects can be returned")
            .not().throws(_=> new Observable(sink => {}).subscribe(sink))
            ._("Non-functions can be returned")
            .not().throws(_=> new Observable(sink => 0).subscribe(sink))
            .not().throws(_=> new Observable(sink => false).subscribe(sink))
            ;
        },


        "Call invariants" (test) {

            let called = 0,
                returned = 0;

            let subscription = new Observable(sink => {
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                complete(v) { returned++ },
            });

            subscription.unsubscribe();

            test._("The stop function is called when unsubscribing")
            .equals(called, 1);

            subscription.unsubscribe();

            test._("The stop function is called again when unsubscribe is called again")
            .equals(called, 1);

            test._("The return method of the sink is not automatically called")
            .equals(returned, 0);

            called = 0;

            new Observable(sink => {
                sink.error(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                error(v) {},
            });

            test._("The stop function is called when an error is sent to the sink")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.complete(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                complete(v) {},
            });

            test._("The stop function is called when a return is sent to the sink")
            .equals(called, 1);

        },

    }

});
