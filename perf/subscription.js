import { Observable } from "../src/Observable.js";

function runTest(options = {}) {

    let originalEnqueue = ENQUEUE_MICROTASK,
        nextCount = 0,
        returnCount = 0;

    if (!options.useMicrotaskQueue)
        ENQUEUE_MICROTASK = function(fn) { fn() };

    function log(msg) {

        if (options.log)
            print(msg);
    }

    function run() {

        let observable = new Observable(sink => {

            log("subscribing");

            for (let i = 0; i < options.count; ++i)
                sink.next(i);

            sink.return();
        });

        log("before subscribe");

        let cancel = observable.subscribe({

            next(value) {

                nextCount++;
                log("got value: " + value)
            },

            return() {

                returnCount++;
                log("all done");

                if (returnCount === options.iterations)
                    finish();
            },
        });

        log("after subscribe");
    }

    function finish() {

        ENQUEUE_MICROTASK = originalEnqueue;

        options.callback({

            subscriptions: returnCount,
            deliveries: nextCount,
            time: (+new Date) - startTime,
        });
    }

    let startTime = +new Date;

    for (let i = 0; i < options.iterations; ++i)
        run();
}

let resultA, resultB;

const TEST_ITERATIONS = 100000,
      TEST_COUNT = 10;

function runTestA() {

    runTest({

        iterations: TEST_ITERATIONS,
        count: TEST_COUNT,
        useMicrotaskQueue: true,
        log: false,
        callback: result => {

            resultA = result;
            runTestB();
        }
    });
}

function runTestB() {

    runTest({

        iterations: TEST_ITERATIONS,
        count: TEST_COUNT,
        useMicrotaskQueue: false,
        log: false,
        callback: result => {

            resultB = result;
            reportResults();
        }
    });
}

function reportResults() {

    print(`\n[Microtask subscription]`);
    print(`Subscriptions: ${ resultA.subscriptions }`);
    print(`Sequence Size: ${ TEST_COUNT }`);
    print(`Deliveries: ${ resultA.deliveries }`);
    print(`Time: ${ resultA.time }ms`);

    print(`\n[Synchronous subscription]`);
    print(`Subscriptions: ${ resultB.subscriptions }`);
    print(`Sequence Size: ${ TEST_COUNT }`);
    print(`Deliveries: ${ resultB.deliveries }`);
    print(`Time: ${ resultB.time }ms`);

    print(``);
    print(`Delta: ${ resultA.time - resultB.time }ms`);
    print(`Delta/subscription: ${ (resultA.time - resultB.time) / resultB.subscriptions }ms`);
    print(`Delta/delivery: ${ (resultA.time - resultB.time) / resultB.deliveries }ms`);

    let baseSubTime = resultB.time / resultB.subscriptions,
        mtSubTime = resultA.time / resultA.subscriptions;

    print(``);
}

runTestA();
