/*=esdown=*/(function(fn, deps, name) { function obj() { return {} } if (typeof exports !== 'undefined') fn(require, exports, module); else if (typeof define === 'function' && define.amd) define(['require', 'exports', 'module'].concat(deps), fn); else if (typeof window !== 'undefined' && name) fn(obj, window[name] = {}, {}); else fn(obj, {}, {}); })(function(require, exports, module) { 'use strict'; function __load(p, l) { module.__es6 = !l; var e = require(p); if (e && e.constructor !== Object) e.default = e; return e; } var _M6 = {}, _M4 = {}, _M5 = {}, _M3 = {}, _M2 = {}, _M1 = exports;

(function(exports) {

var OP_toString = Object.prototype.toString,
    OP_hasOwnProperty = Object.prototype.hasOwnProperty;

// Returns the internal class of an object
function getClass(o) {

	if (o === null || o === undefined) return "Object";
	return OP_toString.call(o).slice("[object ".length, -1);
}

// Returns true if the argument is a Date object
function isDate(obj) {

    return getClass(obj) === "Date";
}

// Returns true if the argument is an object
function isObject(obj) {

    return obj && typeof obj === "object";
}

// Returns true if the arguments are "equal"
function equal(a, b) {

    if (Object.is(a, b))
        return true;

	// Dates must have equal time values
	if (isDate(a) && isDate(b))
		return a.getTime() === b.getTime();

	// Non-objects must be strictly equal (types must be equal)
	if (!isObject(a) || !isObject(b))
		return a === b;

	// Prototypes must be identical.  getPrototypeOf may throw on
	// ES3 engines that don't provide access to the prototype.
	try {

	    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
		    return false;

	} catch (err) {}

	var aKeys = Object.keys(a),
		bKeys = Object.keys(b);

	// Number of own properties must be identical
	if (aKeys.length !== bKeys.length)
		return false;

	for (var i$0 = 0; i$0 < aKeys.length; ++i$0) {

		// Names of own properties must be identical
		if (!OP_hasOwnProperty.call(b, aKeys[i$0]))
			return false;

		// Values of own properties must be equal
		if (!equal(a[aKeys[i$0]], b[aKeys[i$0]]))
			return false;
	}

	return true;
}

var Test = _esdown.class(function(__) { var Test;

	__({ constructor: Test = function(logger) {

		this._name = "";
		this._not = false;
		this._logger = logger;
	},

	_: function(name) {

	    this._name = name;
	    return this;
	},

	name: function(name) {

		this._name = name;
		return this;
	},

	not: function() {

		this._not = !this._not;
		return this;
	},

	assert: function(val) {

		return this._assert(val, {
			method: "assert"
		});
	},

	equals: function(actual, expected) {

		return this._assert(equal(actual, expected), {
			actual: actual,
			expected: expected,
			method: "equal"
		});
	},

	throws: function(fn, error) {

		var threw = false;

		try { fn(); }
		catch (x) { threw = (error === undefined || x === error || x instanceof error); }

		return this._assert(threw, {
			method: "throws"
		});
	},

	comment: function(msg) {

	    this._logger.comment(msg);
	},

	_assert: function(pred, data) {

		var pass = !!pred,
			method = data.method || "";

		if (this._not) {
			pass = !pass;
			method = "not " + method;
		}

		var obj = { name: this._name, pass: pass, method: method };
		Object.keys(data).forEach(function(k) { return obj[k] || (obj[k] = data[k]); });

		this._logger.log(obj);
		this._not = false;

		return this;
	}});

 });

exports.Test = Test;


}).call(this, _M6);

(function(exports) {

var ELEMENT_ID = "unit-test-output";

function findTarget() {

    var e;

    for (var w$0 = window; w$0; w$0 = w$0.parent) {

        e = w$0.document.getElementById(ELEMENT_ID);

        if (e)
            return e;
    }

    return null;
}

var HtmlLogger = _esdown.class(function(__) { var HtmlLogger;

    __({ constructor: HtmlLogger = function() {

        this.target = findTarget();
        this.clear();
    },

    clear: function() {

        this.depth = 0;
        this.passed = 0;
        this.failed = 0;
        this.html = "";

        if (this.target)
            this.target.innerHTML = "";
    },

    end: function() {

        this._flush();
    },

    pushGroup: function(name) {

        this.depth += 1;

        this._writeHeader(name, this.depth);
    },

    popGroup: function() {

        this.depth -= 1;
        this._flush();
    },

    log: function(result) {

        var passed = !!result.pass;

        if (passed) this.passed++;
        else this.failed++;

        this.html +=
        "<div class='" + (result.pass ? "pass" : "fail") + "'>\n\
            " + (result.name) + " <span class=\"status\">[" + (passed ? "OK" : "FAIL") + "]</span>\n\
        </div>";
    },

    comment: function(msg) {

        this.html += "<p class=\"comment\">" + (msg) + "</p>";
    },

    error: function(e) {

        if (e)
            this.html += "<p class=\"error\">" + (e.stack) + "</p>";
    },

    _writeHeader: function(name) {

        var level = Math.min(Math.max(2, this.depth + 1), 6);
        this.html += "<h" + (level) + ">" + (name) + "</h" + (level) + ">";
    },

    _flush: function() {

        if (!this.target)
            return;

        var document = this.target.ownerDocument,
            div = document.createElement("div"),
            frag = document.createDocumentFragment(),
            child;

        div.innerHTML = this.html;
        this.html = "";

        while (child = div.firstChild)
            frag.appendChild(child);

        if (this.target)
            this.target.appendChild(frag);

        div = null;
    }});
 });

exports.HtmlLogger = HtmlLogger;


}).call(this, _M4);

(function(exports) {

var Style = {

    green: function(msg) { return "\x1B[32m" + (msg) + "\x1B[39m" },
    red: function(msg) { return "\x1B[31m" + (msg) + "\x1B[39m" },
    gray: function(msg) { return "\x1B[90m" + (msg) + "\x1B[39m" },
    bold: function(msg) { return "\x1B[1m" + (msg) + "\x1B[22m" }
}

var NodeLogger = _esdown.class(function(__) { var NodeLogger;

    __({ constructor: NodeLogger = function() {

        this.clear();
    },

    clear: function() {

        this.depth = 0;
        this.passed = 0;
        this.failed = 0;
        this.margin = false;
    },

    get indent() {

        return " ".repeat(Math.max(this.depth, 0) * 2);
    },

    end: function() {

        // Empty
    },

    pushGroup: function(name) {

        this._newline();
        this._write(Style.bold("" + (this.indent) + "" + (name) + ""));

        this.depth += 1;
    },

    popGroup: function() {

        this.depth -= 1;
    },

    log: function(result) {

        var passed = !!result.pass;

        if (passed) this.passed++;
        else this.failed++;

        this._write("" + (this.indent) + "" + (result.name) + " " +
            "" + (Style.bold(passed ? Style.green("OK") : Style.red("FAIL"))) + "");
    },

    error: function(e) {

        if (e)
            this._write("\n" + Style.red(e.stack) + "\n");
    },

    comment: function(msg) {

        this._newline();
        this._write(this.indent + Style.gray(msg));
        this._newline();
    },

    _write: function(text) {

        console.log(text);
        this.margin = false;
    },

    _newline: function() {

        if (!this.margin)
            console.log("");

        this.margin = true;
    }});
 });

exports.NodeLogger = NodeLogger;


}).call(this, _M5);

(function(exports) {

var HtmlLogger = _M4.HtmlLogger;
var NodeLogger = _M5.NodeLogger;

var Logger = (typeof global === "object" && global.process) ?
    NodeLogger :
    HtmlLogger;

exports.Logger = Logger;


}).call(this, _M3);

(function(exports) {

var Test = _M6.Test;
var Logger = _M3.Logger;

var TestRunner = _esdown.class(function(__) { var TestRunner;

    __({ constructor: TestRunner = function() {

        this.logger = new Logger;
        this.injections = {};
    },

    inject: function(obj) { var __this = this; 

        Object.keys(obj || {}).forEach(function(k) { return __this.injections[k] = obj[k]; });
        return this;
    },

    run: function(tests) { var __this = this; 

        this.logger.clear();
        this.logger.comment("Starting tests...");

        return this._visit(tests).then(function(val) {

            __this.logger.comment("Passed " + (__this.logger.passed) + " tests and failed " + (__this.logger.failed) + " tests.");
            __this.logger.end();
            return __this;
        });
    },

    _exec: function(fn) { var __this = this; 

        return new Promise(function(resolve) {

            resolve(fn(new Test(__this.logger), __this.injections));

        }).catch(function(error) {

            __this.logger.error(error);
            throw error;
        });
    },

    _visit: function(node) { var __this = this; 

        return new Promise(function(resolve) {

            var list = Object.keys(node);

            var next = function($) {

                if (list.length === 0)
                    return;

                var k = list.shift();

                __this.logger.pushGroup(k);

                var p = typeof node[k] === "function" ?
                    __this._exec(node[k]) :
                    __this._visit(node[k]);

                return p.then(function($) { return __this.logger.popGroup(); }).then(next);
            };

            resolve(next());
        });
    }});
 });

exports.TestRunner = TestRunner;


}).call(this, _M2);

(function(exports) {

var TestRunner = _M2.TestRunner;
var Logger = _M3.Logger;

function runTests(tests) {

    return new TestRunner().run(tests);
}



exports.runTests = runTests;
exports.TestRunner = TestRunner;


}).call(this, _M1);


}, [], "");