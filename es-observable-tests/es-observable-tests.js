/*=esdown=*/(function(fn, name) { if (typeof exports !== 'undefined') fn(exports, module); else if (typeof self !== 'undefined') fn(name === '*' ? self : (name ? self[name] = {} : {})); })(function(exports, module) { 'use strict'; var _esdown = {}; (function() { var exports = _esdown;

var VERSION = "1.0.9";

var GLOBAL = (function() {

    try { return global.global } catch (x) {}
    try { return self.self } catch (x) {}
    return null;
})();

var ownNames = Object.getOwnPropertyNames,
      ownSymbols = Object.getOwnPropertySymbols,
      getDesc = Object.getOwnPropertyDescriptor,
      defineProp = Object.defineProperty;

function toObject(val) {

    if (val == null) // null or undefined
        throw new TypeError(val + " is not an object");

    return Object(val);
}

// Iterates over the descriptors for each own property of an object
function forEachDesc(obj, fn) {

    ownNames(obj).forEach(function(name) { return fn(name, getDesc(obj, name)); });
    if (ownSymbols) ownSymbols(obj).forEach(function(name) { return fn(name, getDesc(obj, name)); });
}

// Installs a property into an object, merging "get" and "set" functions
function mergeProp(target, name, desc, enumerable) {

    if (desc.get || desc.set) {

        var d$0 = { configurable: true };
        if (desc.get) d$0.get = desc.get;
        if (desc.set) d$0.set = desc.set;
        desc = d$0;
    }

    desc.enumerable = enumerable;
    defineProp(target, name, desc);
}

// Installs properties on an object, merging "get" and "set" functions
function mergeProps(target, source, enumerable) {

    forEachDesc(source, function(name, desc) { return mergeProp(target, name, desc, enumerable); });
}

// Builds a class
function makeClass(def) {

    var parent = Object.prototype,
        proto = Object.create(parent),
        statics = {};

    def(function(obj) { return mergeProps(proto, obj, false); },
        function(obj) { return mergeProps(statics, obj, false); });

    var ctor = proto.constructor;
    ctor.prototype = proto;

    // Set class "static" methods
    forEachDesc(statics, function(name, desc) { return defineProp(ctor, name, desc); });

    return ctor;
}

// Support for computed property names
function computed(target) {

    for (var i$0 = 1; i$0 < arguments.length; i$0 += 3) {

        var desc$0 = getDesc(arguments[i$0 + 1], "_");
        mergeProp(target, arguments[i$0], desc$0, true);

        if (i$0 + 2 < arguments.length)
            mergeProps(target, arguments[i$0 + 2], true);
    }

    return target;
}

// Support for async functions
function asyncFunction(iter) {

    return new Promise(function(resolve, reject) {

        resume("next", void 0);

        function resume(type, value) {

            try {

                var result$0 = iter[type](value);

                if (result$0.done) {

                    resolve(result$0.value);

                } else {

                    Promise.resolve(result$0.value).then(
                        function(x) { return resume("next", x); },
                        function(x) { return resume("throw", x); });
                }

            } catch (x) { reject(x) }
        }
    });
}

// Support for for-await
function asyncIterator(obj) {

    var method = obj[Symbol.asyncIterator] || obj[Symbol.iterator];
    return method.call(obj);
}

// Support for async generators
function asyncGenerator(iter) {

    var front = null, back = null;

    var aIter = {

        next: function(val) { return send("next", val) },
        throw: function(val) { return send("throw", val) },
        return: function(val) { return send("return", val) },
    };

    aIter[Symbol.asyncIterator] = function() { return this };
    return aIter;

    function send(type, value) {

        return new Promise(function(resolve, reject) {

            var x = { type: type, value: value, resolve: resolve, reject: reject, next: null };

            if (back) {

                // If list is not empty, then push onto the end
                back = back.next = x;

            } else {

                // Create new list and resume generator
                front = back = x;
                resume(type, value);
            }
        });
    }

    function settle(type, value) {

        switch (type) {

            case "return":
                front.resolve({ value: value, done: true });
                break;

            case "throw":
                front.reject(value);
                break;

            default:
                front.resolve({ value: value, done: false });
                break;
        }

        front = front.next;

        if (front) resume(front.type, front.value);
        else back = null;
    }

    function resume(type, value) {

        // HACK: If the generator does not support the "return" method, then
        // emulate it (poorly) using throw.  (V8 circa 2015-02-13 does not support
        // generator.return.)
        if (type === "return" && !(type in iter)) {

            type = "throw";
            value = { value: value, __return: true };
        }

        try {

            var result$1 = iter[type](value);
            value = result$1.value;

            if (value && typeof value === "object" && "_esdown_await" in value) {

                if (result$1.done)
                    throw new Error("Invalid async generator return");

                Promise.resolve(value._esdown_await).then(
                    function(x) { return resume("next", x); },
                    function(x) { return resume("throw", x); });

            } else {

                settle(result$1.done ? "return" : "normal", result$1.value);
            }

        } catch (x) {

            // HACK: Return-as-throw
            if (x && x.__return === true)
                return settle("return", x.value);

            settle("throw", x);
        }
    }
}

// Support for spread operations
function spread(initial) {

    return {

        a: initial || [],

        // Add items
        s: function() {

            for (var i$1 = 0; i$1 < arguments.length; ++i$1)
                this.a.push(arguments[i$1]);

            return this;
        },

        // Add the contents of iterables
        i: function(list) {

            if (Array.isArray(list)) {

                this.a.push.apply(this.a, list);

            } else {

                for (var __$0 = (list)[Symbol.iterator](), __$1; __$1 = __$0.next(), !__$1.done;)
                    { var item$0 = __$1.value; this.a.push(item$0); }
            }

            return this;
        },

    };
}

// Support for object destructuring
function objd(obj) {

    return toObject(obj);
}

// Support for array destructuring
function arrayd(obj) {

    if (Array.isArray(obj)) {

        return {

            at: function(skip, pos) { return obj[pos] },
            rest: function(skip, pos) { return obj.slice(pos) },
        };
    }

    var iter = toObject(obj)[Symbol.iterator]();

    return {

        at: function(skip) {

            var r;

            while (skip--)
                r = iter.next();

            return r.value;
        },

        rest: function(skip) {

            var a = [], r;

            while (--skip)
                r = iter.next();

            while (r = iter.next(), !r.done)
                a.push(r.value);

            return a;
        },
    };
}










exports.computed = computed;
exports.spread = spread;
exports.objd = objd;
exports.arrayd = arrayd;
exports.class = makeClass;
exports.version = VERSION;
exports.global = GLOBAL;
exports.async = asyncFunction;
exports.asyncGen = asyncGenerator;
exports.asyncIter = asyncIterator;


})();

var __M; (function(a) { var list = Array(a.length / 2); __M = function(i) { var m = list[i], f, e, ee; if (typeof m !== 'function') return m.exports; f = m; m = { exports: i ? {} : exports }; f(list[i] = m, e = m.exports); ee = m.exports; if (ee && ee !== e && !('default' in ee)) ee['default'] = ee; return ee; }; for (var i = 0; i < a.length; i += 2) { var j = Math.abs(a[i]); list[j] = a[i + 1]; if (a[i] >= 0) __M(j); } })([
18, function(module, exports) {

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

// ES6 Object.is
function sameValue(left, right) {

    if (left === right)
        return left !== 0 || 1 / left === 1 / right;

    return left !== left && right !== right;
}

// Returns true if the arguments are "equal"
function equal(a, b) {

    if (sameValue(a, b))
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
			method: "assert",
            actual: val,
            expected: true,
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

		var threw = false,
            actual;

		try { fn() }
		catch (x) {
            actual = x;
            threw = (error === undefined || x === error || x instanceof error);
        }

		return this._assert(threw, {
			method: "throws",
            actual: actual,
            expected: error,
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


},
16, function(module, exports) {

var ELEMENT_ID = "moon-unit";

function findTarget() {

    var e;

    for (var w$0 = window; w$0; w$0 = w$0.parent) {

        e = w$0.document.getElementById(ELEMENT_ID);

        if (e)
            return e;

        if (w$0.parent === w$0)
            break;
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

        this.target.appendChild(frag);
        div = null;
    }});
 });

exports.HtmlLogger = HtmlLogger;


},
17, function(module, exports) {

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

        this.passed = 0;
        this.failed = 0;
        this.failList = [];
        this.path = [];
        this.margin = false;
    },

    get indent() {

        return new Array(Math.max(this.path.length, 0) * 2 + 1).join(" ");
    },

    end: function() { var __this = this; 

        this.failList.forEach(function(__$0) { var __$1; var path = (__$1 = _esdown.objd(__$0), __$1.path), result = __$1.result; 

            if (result.name)
                path += " > " + result.name;

            __this._write(Style.bold("[" + path + "]"));
            __this._write("Actual: " + result.actual);
            __this._write("Expected: " + result.expected);
            __this._newline();
        });
    },

    pushGroup: function(name) {

        this._newline();
        this._write(Style.bold("" + (this.indent) + "" + (name) + ""));
        this.path.push(name);
    },

    popGroup: function() {

        this.path.pop();
    },

    log: function(result) {

        var passed = !!result.pass;

        if (passed) this.passed++;
        else this.failed++;

        if (!passed)
            this.failList.push({ path: this.path.join(" > "), result: result });

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


},
15, function(module, exports) {

var HtmlLogger = __M(16).HtmlLogger;
var NodeLogger = __M(17).NodeLogger;

var Logger = (typeof global === "object" && global.process) ?
    NodeLogger :
    HtmlLogger;

exports.Logger = Logger;


},
14, function(module, exports) {

var Test = __M(18).Test;
var Logger = __M(15).Logger;

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


},
12, function(module, exports) {

var TestRunner = __M(14).TestRunner;
var Logger = __M(15).Logger;

function runTests(tests) {

    return new TestRunner().run(tests);
}



exports.runTests = runTests;
exports.TestRunner = TestRunner;


},
1, function(module, exports) {

Object.keys(__M(12)).forEach(function(k) { exports[k] = __M(12)[k]; });


},
13, function(module, exports) {

function testLength(test, value, length) {

    if (typeof value !== "function" || typeof length !== "number")
        return;

    test._("Function length is " + length)
    .equals(value.length, length);
}

function testMethodProperty(test, object, key, options) {

    var desc = Object.getOwnPropertyDescriptor(object, key);

    if (options.get || options.set) {

        test._("Property " + (options.get ? "has" : "does not have") + " a getter")
        .equals(typeof desc.get, options.get ? "function" : "undefined");

        testLength(test, desc.get, 0);

        test._("Property " + (options.set ? "has" : "does not have") + " a setter")
        .equals(typeof desc.set, options.set ? "function" : "undefined");

        testLength(test, desc.set, 1);

    } else {

        test._("Property has a function value")
        .equals(typeof desc.value, "function");

        testLength(test, desc.value, options.length);

        test._("Property is " + (options.writable ? "" : "non-") + "writable")
        .equals(desc.writable, Boolean(options.writable));
    }


    test
    ._("Property is " + (options.enumerable ? "" : "non-") + "enumerable")
    .equals(desc.enumerable, Boolean(options.enumerable))
    ._("Property is " + (options.configurable ? "" : "non-") + "configurable")
    .equals(desc.configurable, Boolean(options.configurable))
    ;

}

function hasSymbol(name) {

    return typeof Symbol === "function" && Boolean(Symbol[name]);
}

function getSymbol(name) {

    return hasSymbol(name) ? Symbol[name] : "@@" + name;
}

exports.testMethodProperty = testMethodProperty;
exports.hasSymbol = hasSymbol;
exports.getSymbol = getSymbol;


},
2, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "Argument types": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        test
        ._("The first argument cannot be a non-callable object")
        .throws(function(_) { return new Observable({}); }, TypeError)
        ._("The first argument cannot be a primative value")
        .throws(function(_) { return new Observable(false); }, TypeError)
        .throws(function(_) { return new Observable(null); }, TypeError)
        .throws(function(_) { return new Observable(undefined); }, TypeError)
        .throws(function(_) { return new Observable(1); }, TypeError)
        ._("The first argument can be a function")
        .not().throws(function(_) { return new Observable(function() {}); })
        ;
    },

    "Observable.prototype has a constructor property": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable.prototype, "constructor", {
            configurable: true,
            writable: true,
            length: 1,
        });

        test._("Observable.prototype.constructor === Observable")
        .equals(Observable.prototype.constructor, Observable);
    },

    "Subscriber function is not called by constructor": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called = 0;
        new Observable(function(_) { return called++; });

        test
        ._("The constructor does not call the subscriber function")
        .equals(called, 0)
        ;
    },

};


},
3, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "Observable.prototype has a subscribe property": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable.prototype, "subscribe", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Argument type": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var x = new Observable(function(sink) { return null; });

        test
        ._("Throws if observer is not an object")
        .throws(function(_) { return x.subscribe(null); }, TypeError)
        .throws(function(_) { return x.subscribe(undefined); }, TypeError)
        .throws(function(_) { return x.subscribe(1); }, TypeError)
        .throws(function(_) { return x.subscribe(true); }, TypeError)
        .throws(function(_) { return x.subscribe("string"); }, TypeError)

        ._("Any object may be an observer")
        .not().throws(function(_) { return x.subscribe({}); })
        .not().throws(function(_) { return x.subscribe(Object(1)); })
        .not().throws(function(_) { return x.subscribe(function() {}); })
        ;
    },

    "Subscriber arguments": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer = null;
        new Observable(function(x) { observer = x }).subscribe({});

        test._("Subscriber is called with an observer")
        .equals(typeof observer, "object")
        .equals(typeof observer.next, "function")
        .equals(typeof observer.error, "function")
        .equals(typeof observer.complete, "function")
        ;

        test._("Subscription observer's constructor property is Object")
        .equals(observer.constructor, Object);
    },

    "Subscriber return types": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var type = "", sink = {};

        test
        ._("Undefined can be returned")
        .not().throws(function(_) { return new Observable(function(sink) { return undefined; }).subscribe(sink); })
        ._("Null can be returned")
        .not().throws(function(_) { return new Observable(function(sink) { return null; }).subscribe(sink); })
        ._("Functions can be returned")
        .not().throws(function(_) { return new Observable(function(sink) { return function() {}; }).subscribe(sink); })
        ._("Subscriptions can be returned")
        .not().throws(function(_) { return new Observable(function(sink) { return ({ unsubscribe: function() {} }).subscribe(sink); }); })
        ._("Non callable, non-subscription objects cannot be returned")
        .throws(function(_) { return new Observable(function(sink) { return ({}); }).subscribe(sink); }, TypeError)
        ._("Non-functions cannot be returned")
        .throws(function(_) { return new Observable(function(sink) { return 0; }).subscribe(sink); }, TypeError)
        .throws(function(_) { return new Observable(function(sink) { return false; }).subscribe(sink); }, TypeError)
        ;
    },

    "Returns a subscription object": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called = 0;
        var subscription = new Observable(function(observer) {
            return function(_) { return called++; };
        }).subscribe({});

        var proto = Object.getPrototypeOf(subscription);

        test
        ._("Subscribe returns an object")
        .equals(typeof subscription, "object")
        ._("Subscriptions have an unsubscribe method")
        .equals(typeof subscription.unsubscribe, "function")
        ._("Contructor property is Object")
        .equals(subscription.constructor, Object)
        ._("Unsubscribe is defined on the prototype object")
        .equals(subscription.unsubscribe, proto.unsubscribe)
        ._("Unsubscribe returns undefined")
        .equals(subscription.unsubscribe(), undefined)
        ._("Unsubscribe calls the cleanup function")
        .equals(called, 1)
        ;
    },

    "Cleanup function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called = 0,
            returned = 0;

        var subscription = new Observable(function(sink) {
            return function(_) { called++ };
        }).subscribe({
            complete: function() { returned++ },
        });

        subscription.unsubscribe();

        test._("The cleanup function is called when unsubscribing")
        .equals(called, 1);

        subscription.unsubscribe();

        test._("The cleanup function is not called again when unsubscribe is called again")
        .equals(called, 1);

        called = 0;

        new Observable(function(sink) {
            sink.error(1);
            return function(_) { called++ };
        }).subscribe({
            error: function() {},
        });

        test._("The cleanup function is called when an error is sent to the sink")
        .equals(called, 1);

        called = 0;

        new Observable(function(sink) {
            sink.complete(1);
            return function(_) { called++ };
        }).subscribe({
            next: function() {},
        });

        test._("The cleanup function is called when a complete is sent to the sink")
        .equals(called, 1);

        var unsubscribeArgs = null;
        called = 0;

        subscription = new Observable(function(sink) {
            return {
                unsubscribe: function() { for (var args = [], __$0 = 0; __$0 < arguments.length; ++__$0) args.push(arguments[__$0]); 
                    called = 1;
                    unsubscribeArgs = args;
                }
            };
        }).subscribe({
            next: function() {},
        });

        subscription.unsubscribe(1);
        test._("If a subscription is returned, then unsubscribe is called on cleanup")
        .equals(called, 1)
        ._("Arguments are not forwarded to the unsubscribe function")
        .equals(unsubscribeArgs, []);

    },

    "Exceptions thrown from the subscriber": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var error = new Error(),
            observable = new Observable(function(_) { throw error });

        test._("Subscribe throws if the observer does not handle errors")
        .throws(function(_) { return observable.subscribe({}); }, error);

        var thrown = null;
        observable.subscribe({ error: function(e) { thrown = e } });

        test._("Subscribe sends an error to the observer")
        .equals(thrown, error);
    },

};


},
4, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "Observable.prototype has a forEach property": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable.prototype, "forEach", {
            configurable: true,
            writable: true,
            length: 1,
        });
    },

    "Argument must be a function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var result = Observable.prototype.forEach.call({}, {});

        test._("If the first argument is not a function, a promise is returned")
        .assert(result instanceof Promise);

        return result.then(function(_) { return null; }, function(e) { return e; }).then(function(error) {

            test._("The promise is rejected with a TypeError")
            .assert(Boolean(error))
            .assert(error instanceof TypeError);
        });
    },

    "Subscribe is called on the 'this' value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called = 0,
            observer = null;

        Observable.prototype.forEach.call({

            subscribe: function(x) {
                called++;
                observer = x;
            }

        }, function(_) { return null; });

        test._("The subscribe method is called with an observer")
        .equals(called, 1)
        .equals(typeof observer, "object")
        .equals(typeof observer.next, "function")
        ;
    },

    "Error rejects the promise": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var error = new Error();

        return new Observable(function(observer) { observer.error(error) })
            .forEach(function(_) { return null; })
            .then(function(_) { return null; }, function(e) { return e; })
            .then(function(value) {
                test._("Sending error rejects the promise with the supplied value")
                .equals(value, error);
            });
    },

    "Complete resolves the promise": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        return new Observable(function(observer) { observer.complete(token) })
            .forEach(function(_) { return null; })
            .then(function(x) { return x; }, function(e) { return null; })
            .then(function(value) {
                test._("Sending complete resolves the promise with the supplied value")
                .equals(value, token);
            });
    },

    "The callback is called with the next value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var values = [], thisArg;

        return new Observable(function(observer) {

            observer.next(1);
            observer.next(2);
            observer.next(3);
            observer.complete();

        }).forEach(function(x) {

            thisArg = this;
            values.push(x);

        }).then(function(_) {

            test
            ._("The callback receives each next value")
            .equals(values, [1, 2, 3])
            ._("The callback receives undefined as the this value")
            .equals(thisArg, undefined);

        });
    },

    "If the callback throws an error, the promise is rejected": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var error = new Error();

        return new Observable(function(observer) { observer.next(1) })
            .forEach(function(_) { throw error })
            .then(function(_) { return null; }, function(e) { return e; })
            .then(function(value) {
                test._("The promise is rejected with the thrown value")
                .equals(value, error);
            });
    },

    "If the callback throws an error, the callback function is not called again": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var callCount = 0;

        return new Observable(function(observer) {
            observer.next(1);
            observer.next(2);
            observer.next(3);
        }).forEach(function(x) {
            callCount++;
            throw new Error();
        }).catch(function(x) {
            test._("The callback is not called again after throwing an error")
            .equals(callCount, 1);
        });
    },

};


},
5, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty, getSymbol = __M(13).getSymbol;

exports["default"] = {

    "Observable.prototype has a Symbol.observable method": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable.prototype, getSymbol("observable"), {
            configurable: true,
            writable: true,
            length: 0
        });
    },

    "Return value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var desc = Object.getOwnPropertyDescriptor(Observable.prototype, getSymbol("observable")),
            thisVal = {};

        test._("Returns the 'this' value").equals(desc.value.call(thisVal), thisVal);
    }

};


},
6, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty, getSymbol = __M(13).getSymbol;

exports["default"] = {

    "Observable has a species method": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable, getSymbol("species"), {
            get: true,
            configurable: true
        });
    },

    "Return value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var desc = Object.getOwnPropertyDescriptor(Observable, getSymbol("species")),
            thisVal = {};

        test._("Returns the 'this' value").equals(desc.get.call(thisVal), thisVal);
    }

};


},
7, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

// TODO: Verify that Observable.from subscriber returns a cleanup function

exports["default"] = {

    "Observable has an of property": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable, "of", {
            configurable: true,
            writable: true,
            length: 0,
        });
    },

    "Uses the this value if it's a function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var usesThis = false;

        Observable.of.call(function(_) { return usesThis = true; });
        test._("Observable.of will use the 'this' value if it is callable")
        .equals(usesThis, true);
    },

    "Uses 'Observable' if the 'this' value is not a function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var result = Observable.of.call({}, 1, 2, 3, 4);

        test._("Observable.of will use 'Observable' if the this value is not callable")
        .assert(result instanceof Observable);
    },

    "Arguments are delivered to next": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [],
                turns = 0;

            Observable.of(1, 2, 3, 4).subscribe({

                next: function(v) {
                    values.push(v);
                    Promise.resolve().then(function(_) { return turns++; });
                },

                complete: function() {
                    test._("All items are delivered and complete is called")
                    .equals(values, [1, 2, 3, 4]);
                    test._("Items are delivered in a single future turn")
                    .equals(turns, 1);

                    resolve();
                },
            });

            turns++;

        });
    },

    "Responds to cancellation from next": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [];

            var subscription = Observable.of(1, 2, 3, 4).subscribe({

                next: function(v) {

                    values.push(v);
                    subscription.unsubscribe();
                    Promise.resolve().then(function(_) {
                        test._("Cancelling from next stops observation")
                        .equals(values, [1]);
                        resolve();
                    });
                }
            });
        });
    },

    "Responds to cancellation before next is called": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [];

            var subscription = Observable.of(1, 2, 3, 4).subscribe({
                next: function(v) { values.push(v) }
            });

            subscription.unsubscribe();

            Promise.resolve().then(function(_) {
                test._("Cancelling before next is called stops observation")
                .equals(values, []);
                resolve();
            });
        });
    },

};


},
8, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty, hasSymbol = __M(13).hasSymbol, getSymbol = __M(13).getSymbol;

// TODO: Verify that Observable.from subscriber returns a cleanup function

exports["default"] = {

    "Observable has a from property": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        testMethodProperty(test, Observable, "from", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Allowed argument types": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        test
        ._("Null is not allowed")
        .throws(function(_) { return Observable.from(null); }, TypeError)
        ._("Undefined is not allowed")
        .throws(function(_) { return Observable.from(undefined); }, TypeError)
        .throws(function(_) { return Observable.from(); }, TypeError);
    },

    "Uses the this value if it's a function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var usesThis = false;

        Observable.from.call(function(_) { return usesThis = true; }, []);
        test._("Observable.from will use the 'this' value if it is callable")
        .equals(usesThis, true);
    },

    "Uses 'Observable' if the 'this' value is not a function": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var result = Observable.from.call({}, []);

        test._("Observable.from will use 'Observable' if the this value is not callable")
        .assert(result instanceof Observable);
    },

    "Symbol.observable method is accessed": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called = 0;

        Observable.from(_esdown.computed({
            }, getSymbol("observable"), { get _() {
                called++;
                return function(_) { return ({}); };
            }
        }));

        test._("Symbol.observable property is accessed once")
        .equals(called, 1);

        test
        ._("Symbol.observable must be a function")
        .throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: {} })); }, TypeError)
        .throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: 0 })); }, TypeError)
        ._("Null is allowed")
        .not().throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: null })); })
        ._("Undefined is allowed")
        .not().throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: undefined })); })
        ;

        called = 0;
        Observable.from(_esdown.computed({
            }, getSymbol("observable"), { _: function() {
                called++;
                return {};
            }
        }));

        test._("Calls the Symbol.observable method")
        .equals(called, 1);
    },

    "Return value of Symbol.observable": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        test._("Throws if the return value of Symbol.observable is not an object")
        .throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: function() { return 0 } })); }, TypeError)
        .throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: function() { return null } })); }, TypeError)
        .throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: function() {} })); }, TypeError)
        .not().throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: function() { return {} } })); })
        .not().throws(function(_) { return Observable.from(_esdown.computed({ }, getSymbol("observable"), { _: function() { return function(_) {} } })); })
        ;

        var target = function() {},
            returnValue = { constructor: target };

        var result = Observable.from.call(target, _esdown.computed({
            }, getSymbol("observable"), { _: function() { return returnValue }
        }));

        test._("Returns the result of Symbol.observable if the object's constructor property " +
            "is the target")
        .equals(result, returnValue);

        var input = null,
            token = {};

        target = function(fn) {
            this.fn = fn;
            this.token = token;
        };

        result = Observable.from.call(target, _esdown.computed({
            }, getSymbol("observable"), { _: function() {
                return {
                    subscribe: function(x) {
                        input = x;
                        return token;
                    },
                };
            }
        }));

        test._("Calls the constructor if returned object does not have matching constructor " +
            "property")
        .equals(result.token, token)
        ._("Constructor is called with a function")
        .equals(typeof result.fn, "function")
        ._("Calling the function calls subscribe on the object and returns the result")
        .equals(result.fn(123), token)
        ._("The subscriber argument is supplied to the subscribe method")
        .equals(input, 123)
        ;

    },

    "Iterables: values are delivered to next": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [],
                turns = 0,
                iterable = [1, 2, 3, 4];

            if (hasSymbol("iterator"))
                iterable = iterable[Symbol.iterator]();

            Observable.from(iterable).subscribe({

                next: function(v) {
                    values.push(v);
                    Promise.resolve().then(function(_) { return turns++; });
                },

                complete: function() {
                    test._("All items are delivered and complete is called")
                    .equals(values, [1, 2, 3, 4]);
                    test._("Items are delivered in a single future turn")
                    .equals(turns, 1);

                    resolve();
                },
            });

            turns++;

        });
    },

    "Iterables: responds to cancellation from next": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [];

            var subscription = Observable.from([1, 2, 3, 4]).subscribe({

                next: function(v) {

                    values.push(v);
                    subscription.unsubscribe();
                    Promise.resolve().then(function(_) {
                        test._("Cancelling from next stops observation")
                        .equals(values, [1]);
                        resolve();
                    });
                }
            });
        });
    },

    "Iterables: responds to cancellation before next is called": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        return new Promise(function(resolve) {

            var values = [];

            var subscription = Observable.from([1, 2, 3, 4]).subscribe({
                next: function(v) { values.push(v) }
            });

            subscription.unsubscribe();

            Promise.resolve().then(function(_) {
                test._("Cancelling before next is called stops observation")
                .equals(values, []);
                resolve();
            });
        });
    },

    "Non-iterables result in a catchable error": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var error = null;
        Observable.from({}).subscribe({ error: function(e) { error = e } });

        return new Promise(function(resolve) {

            setTimeout(function(_) {

                test._("If argument is not iterable, then error method is called")
                .assert(error instanceof Error);

                resolve();

            }, 10);
        });

    },

};


},
9, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "SubscriptionObserver.prototype has an next method": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer;
        new Observable(function(x) { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "next", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Input value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            observer.next(token);

        }).subscribe({

            next: function(value) { for (var args = [], __$0 = 1; __$0 < arguments.length; ++__$0) args.push(arguments[__$0]); 
                test._("Input value is forwarded to the observer")
                .equals(value, token);
            }

        });
    },

    "Return value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            test._("Returns the value returned from the observer")
            .equals(observer.next(), token);

            observer.complete();

            test._("Returns undefined when closed")
            .equals(observer.next(), undefined);

        }).subscribe({
            next: function() { return token }
        });
    },

    "Method lookup": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer,
            observable = new Observable(function(x) { observer = x });

        observable.subscribe({});
        test._("If property does not exist, then next returns undefined")
        .equals(observer.next(), undefined);

        observable.subscribe({ next: undefined });
        test._("If property is undefined, then next returns undefined")
        .equals(observer.next(), undefined);

        observable.subscribe({ next: null });
        test._("If property is null, then next returns undefined")
        .equals(observer.next(), undefined);

        observable.subscribe({ next: {} });
        test._("If property is not a function, then an error is thrown")
        .throws(function(_) { return observer.next(); }, TypeError);

        var actual = {};
        observable.subscribe(actual);
        actual.next = (function(_) { return 1; });
        test._("Method is not accessed until complete is called")
        .equals(observer.next(), 1);

        var called = 0;
        observable.subscribe({
            get next() {
                called++;
                return function() {};
            }
        });
        observer.complete();
        observer.next();
        test._("Method is not accessed when subscription is closed")
        .equals(called, 0);

        called = 0;
        observable.subscribe({
            get next() {
                called++;
                return function() {};
            }
        });
        observer.next();
        test._("Property is only accessed once during a lookup")
        .equals(called, 1);

    },

    "Cleanup functions": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called, observer;

        var observable = new Observable(function(x) {
            observer = x;
            return function(_) { called++ };
        });

        called = 0;
        observable.subscribe({ next: function() { throw new Error() } });
        try { observer.next() }
        catch (x) {}
        test._("Cleanup function is called when next throws an error")
        .equals(called, 1);

        var error = new Error(), caught = null;

        new Observable(function(x) {
            observer = x;
            return function(_) { throw new Error() };
        }).subscribe({ next: function() { throw error } });

        try { observer.next() }
        catch (x) { caught = x }

        test._("If both next and the cleanup function throw, then the error " +
            "from the next method is thrown")
        .assert(caught === error);

    },

};


},
10, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "SubscriptionObserver.prototype has an error method": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer;
        new Observable(function(x) { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "error", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Input value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            observer.error(token, 1, 2);

        }).subscribe({

            error: function(value) { for (var args = [], __$0 = 1; __$0 < arguments.length; ++__$0) args.push(arguments[__$0]); 
                test._("Input value is forwarded to the observer")
                .equals(value, token)
                ._("Additional arguments are not forwarded")
                .equals(args.length, 0);
            }

        });
    },

    "Return value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            test._("Returns the value returned from the observer")
            .equals(observer.error(), token);

            test._("Throws the input when closed")
            .throws(function(_) { observer.error(token) }, token);

        }).subscribe({
            error: function() { return token }
        });
    },

    "Method lookup": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer,
            error = new Error(),
            observable = new Observable(function(x) { observer = x });

        observable.subscribe({});
        test._("If property does not exist, then error throws the input")
        .throws(function(_) { return observer.error(error); }, error);

        observable.subscribe({ error: undefined });
        test._("If property is undefined, then error throws the input")
        .throws(function(_) { return observer.error(error); }, error);

        observable.subscribe({ error: null });
        test._("If property is null, then error throws the input")
        .throws(function(_) { return observer.error(error); }, error);

        observable.subscribe({ error: {} });
        test._("If property is not a function, then an error is thrown")
        .throws(function(_) { return observer.error(); }, TypeError);

        var actual = {};
        observable.subscribe(actual);
        actual.error = (function(_) { return 1; });
        test._("Method is not accessed until error is called")
        .equals(observer.error(error), 1);

        var called = 0;
        observable.subscribe({
            get error() {
                called++;
                return function() {};
            }
        });
        observer.complete();
        try { observer.error(error) }
        catch (x) {}
        test._("Method is not accessed when subscription is closed")
        .equals(called, 0);

        called = 0;
        observable.subscribe({
            get error() {
                called++;
                return function() {};
            }
        });
        observer.error();
        test._("Property is only accessed once during a lookup")
        .equals(called, 1);

        called = 0;
        observable.subscribe({
            next: function() { called++ },
            get error() {
                called++;
                observer.next();
                return function() {};
            }
        });
        observer.error();
        test._("When method lookup occurs, subscription is closed")
        .equals(called, 1);

    },

    "Cleanup functions": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called, observer;

        var observable = new Observable(function(x) {
            observer = x;
            return function(_) { called++ };
        });

        called = 0;
        observable.subscribe({});
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when observer does not have an error method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error: function() { return 1 } });
        observer.error();
        test._("Cleanup function is called when observer has an error method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ get error() { throw new Error() } });
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when method lookup throws")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ error: function() { throw new Error() } });
        try { observer.error() }
        catch (x) {}
        test._("Cleanup function is called when method throws")
        .equals(called, 1);

        var error = new Error(), caught = null;

        new Observable(function(x) {
            observer = x;
            return function(_) { throw new Error() };
        }).subscribe({ error: function() { throw error } });

        try { observer.error() }
        catch (x) { caught = x }

        test._("If both error and the cleanup function throw, then the error " +
            "from the error method is thrown")
        .assert(caught === error);

    },

};


},
11, function(module, exports) {

var testMethodProperty = __M(13).testMethodProperty;

exports["default"] = {

    "SubscriptionObserver.prototype has a complete method": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer;
        new Observable(function(x) { observer = x }).subscribe({});

        testMethodProperty(test, Object.getPrototypeOf(observer), "complete", {
            configurable: true,
            writable: true,
            length: 1
        });
    },

    "Input value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            observer.complete(token, 1, 2);

        }).subscribe({

            complete: function(value) { for (var args = [], __$0 = 1; __$0 < arguments.length; ++__$0) args.push(arguments[__$0]); 
                test._("Input value is forwarded to the observer")
                .equals(value, token)
                ._("Additional arguments are not forwarded")
                .equals(args.length, 0);
            }

        });
    },

    "Return value": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var token = {};

        new Observable(function(observer) {

            test._("Returns the value returned from the observer")
            .equals(observer.complete(), token);

            test._("Returns undefined when closed")
            .equals(observer.complete(), undefined);

        }).subscribe({
            complete: function() { return token }
        });
    },

    "Method lookup": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var observer,
            observable = new Observable(function(x) { observer = x });

        observable.subscribe({});
        test._("If property does not exist, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: undefined });
        test._("If property is undefined, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: null });
        test._("If property is null, then complete returns undefined")
        .equals(observer.complete(), undefined);

        observable.subscribe({ complete: {} });
        test._("If property is not a function, then an error is thrown")
        .throws(function(_) { return observer.complete(); }, TypeError);

        var actual = {};
        observable.subscribe(actual);
        actual.complete = (function(_) { return 1; });
        test._("Method is not accessed until complete is called")
        .equals(observer.complete(), 1);

        var called = 0;
        observable.subscribe({
            get complete() {
                called++;
                return function() {};
            },
            error: function() {},
        });
        observer.error(new Error());
        observer.complete();
        test._("Method is not accessed when subscription is closed")
        .equals(called, 0);

        called = 0;
        observable.subscribe({
            get complete() {
                called++;
                return function() {};
            }
        });
        observer.complete();
        test._("Property is only accessed once during a lookup")
        .equals(called, 1);

        called = 0;
        observable.subscribe({
            next: function() { called++ },
            get complete() {
                called++;
                observer.next();
                return function() { return 1 };
            }
        });
        observer.complete();
        test._("When method lookup occurs, subscription is closed")
        .equals(called, 1);

    },

    "Cleanup functions": function(test, __$0) { var __$1; var Observable = (__$1 = _esdown.objd(__$0), __$1.Observable); 

        var called, observer;

        var observable = new Observable(function(x) {
            observer = x;
            return function(_) { called++ };
        });

        called = 0;
        observable.subscribe({});
        observer.complete();
        test._("Cleanup function is called when observer does not have a complete method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ complete: function() { return 1 } });
        observer.complete();
        test._("Cleanup function is called when observer has a complete method")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ get complete() { throw new Error() } });
        try { observer.complete() }
        catch (x) {}
        test._("Cleanup function is called when method lookup throws")
        .equals(called, 1);

        called = 0;
        observable.subscribe({ complete: function() { throw new Error() } });
        try { observer.complete() }
        catch (x) {}
        test._("Cleanup function is called when method throws")
        .equals(called, 1);

        var error = new Error(), caught = null;

        new Observable(function(x) {
            observer = x;
            return function(_) { throw new Error() };
        }).subscribe({ complete: function() { throw error } });

        try { observer.complete() }
        catch (x) { caught = x }

        test._("If both complete and the cleanup function throw, then the error " +
            "from the complete method is thrown")
        .assert(caught === error);

    },

};


},
0, function(module, exports) {

var TestRunner = __M(1).TestRunner;

var constructor = __M(2)['default'];
var subscribe = __M(3)['default'];
var forEach = __M(4)['default'];
var observable = __M(5)['default'];
var species = __M(6)['default'];
var ofTests = __M(7)['default'];
var fromTests = __M(8)['default'];

var observerNext = __M(9)['default'];
var observerError = __M(10)['default'];
var observerComplete = __M(11)['default'];


function runTests(C) {

    return new TestRunner().inject({ Observable: C }).run({

        "Observable constructor": constructor,

        "Observable.prototype.subscribe": subscribe,
        "Observable.prototype.forEach": forEach,
        "Observable.prototype[Symbol.observable]": observable,

        "Observable.of": ofTests,
        "Observable.from": fromTests,
        "Observable[Symbol.species]": species,

        "SubscriptionObserver.prototype.next": observerNext,
        "SubscriptionObserver.prototype.error": observerError,
        "SubscriptionObserver.prototype.complete": observerComplete,

    });
}

exports.runTests = runTests;


}]);


}, "ObservableTests");