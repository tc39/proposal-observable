import { runTests } from "moon-unit";
import { Observable } from "../src/Observable.js";

runTests({

    "Stop Functions": {

        "Allowed return values" (test) {

            let sink = { next(v) {} };

            test
            ._("Undefined can be returned")
            .not().throws(_=> new Observable(sink => undefined).subscribe(sink))
            ._("Null can be returned")
            .not().throws(_=> new Observable(sink => null).subscribe(sink))
            ._("Functions can be returned")
            .not().throws(_=> new Observable(sink => function() {}).subscribe(sink))
            ._("Non-functions cannot be returned")
            .throws(_=> new Observable(sink => 0).subscribe(sink))
            .throws(_=> new Observable(sink => false).subscribe(sink))
            .throws(_=> new Observable(sink => ({})).subscribe(sink))
            ;
        },


        "Call invariants" (test) {

            let called = 0,
                returned = 0;

            let cancel = new Observable(sink => {
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                return(v) { returned++ },
            });

            cancel();

            test._("The stop function is called when cancelling")
            .equals(called, 1);

            cancel();

            test._("The stop function is not called again when cancel is called again")
            .equals(called, 1);

            test._("The return method of the sink is not automatically called")
            .equals(returned, 0);

            called = 0;

            new Observable(sink => {
                sink.next(1);
                return _=> { called++ };
            }).subscribe({
                next(v) { return { done: true } },
            });

            test._("The stop function is called when the sink returns a done result")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.throw(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                throw(v) {},
            });

            test._("The stop function is called when an error is sent to the sink")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.return(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                return(v) {},
            });

            test._("The stop function is called when a return is sent to the sink")
            .equals(called, 1);

        },


        "Default stop behavior" (test) {

            let cancel;

            let sink = {

                called: 0,
                next(v) {},
                throw(v) {},
                return(v) { this.called++ },
            };

            cancel = new Observable(sink => {}).subscribe(sink);
            cancel();

            test
            ._("The default stop function calls return on the underlying sink")
            .equals(sink.called, 1);

            sink.called = 0;
            cancel = new Observable(sink => null).subscribe(sink);
            cancel();

            test
            ._("The default stop function is used when the return value is null")
            .equals(sink.called, 1);

            cancel();

            test
            ._("Return is not called on the underlying sink more than once")
            .equals(sink.called, 1);
        },

    }

});
