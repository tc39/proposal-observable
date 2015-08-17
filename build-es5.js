var ChildProcess = require("child_process");

var args = "- ./src/Observable.js ../build/esdown.js -b -r -p -g esdown";

var child = ChildProcess.spawn(
    "esdown",
    "- ./polyfill.js ./es5/observable-polyfill.js -r".split(/ /g),
    { stdio: "inherit", env: process.env, cwd: __dirname });

child.on("close", function() {

    ChildProcess.spawn(
        "esdown",
        "- ./test/default.js ./es5/observable-tests.js -b -r -g ObservableTests".split(/ /g),
        { stdio: "inherit", env: process.env, cwd: __dirname });
});
