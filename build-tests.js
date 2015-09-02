var ChildProcess = require("child_process");

function compile(args) {

    return new Promise(function(resolve) {

        var child = ChildProcess.spawn(
            "esdown",
            ("- " + args).split(/ /g),
            { stdio: "inherit", env: process.env, cwd: __dirname });

        child.on("close", resolve);
    });
}

compile("./test/default.js ./es-observable-tests/es-observable-tests.js -b -r -g ObservableTests");
