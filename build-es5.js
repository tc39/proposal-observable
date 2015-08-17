var ChildProcess = require("child_process");

var args = "- ./src/Observable.js ../build/esdown.js -b -r -p -g esdown";

function compile(args) {

    return new Promise(function(resolve) {

        var child = ChildProcess.spawn(
            "esdown",
            ("- " + args).split(/ /g),
            { stdio: "inherit", env: process.env, cwd: __dirname });

        child.on("close", resolve);
    });
}

compile("./polyfill.js ./es5/observable-polyfill.js -b -r").then(function() {
    return compile("./test/default.js ./es5/observable-tests.js -b -r -g ObservableTests");
});
