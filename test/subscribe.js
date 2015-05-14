import { runTests } from "moon-unit";
import { Observable } from "../src/Observable.js";

function makeObservable(init) {

    return new Observable(sink => {

        let controller = init(sink);
        controller.start();
        return _=> { controller.stop() };
    });
}

const tests = {

    "Observer type" (test) {

        let x = new Observable(sink => null);

        test
        ._("Throws if observer is not an object")
        .throws(_=> x.subscribe(null))
        .throws(_=> x.subscribe(undefined))
        .throws(_=> x.subscribe(1))
        .throws(_=> x.subscribe(true))
        .throws(_=> x.subscribe("string"))
        .throws(_=> x.subscribe(Symbol("test")))

        ._("Any object may be an observer")
        .not().throws(_=> x.subscribe({}))
        .not().throws(_=> x.subscribe(Object(1)))
        .not().throws(_=> x.subscribe(function() {}))

        ;
    }
};
