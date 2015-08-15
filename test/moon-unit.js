/*=esdown=*/(function(fn, deps, name) { function obj() { return {} } if (typeof exports !== 'undefined') fn(require, exports, module); else if (typeof define === 'function' && define.amd) define(['require', 'exports', 'module'].concat(deps), fn); else if (typeof window !== 'undefined' && name) fn(obj, window[name] = {}, {}); else fn(obj, {}, {}); })(function(require, exports, module) { 'use strict'; function __load(p, l) { module.__es6 = !l; var e = require(p); if (e && e.constructor !== Object) e.default = e; return e; } 
var _esdown; (function() {

var VERSION = "0.9.11";

var Global = (function() {

    try { return global.global } catch (x) {}
    try { return self.self } catch (x) {}
    return null;
})();

function toObject(val) {

    if (val == null)
        throw new TypeError(val + " is not an object");

    return Object(val);
}

// Iterates over the descriptors for each own property of an object
function forEachDesc(obj, fn) {

    var names = Object.getOwnPropertyNames(obj);

    for (var i$0 = 0; i$0 < names.length; ++i$0)
        fn(names[i$0], Object.getOwnPropertyDescriptor(obj, names[i$0]));

    names = Object.getOwnPropertySymbols(obj);

    for (var i$1 = 0; i$1 < names.length; ++i$1)
        fn(names[i$1], Object.getOwnPropertyDescriptor(obj, names[i$1]));

    return obj;
}

// Installs a property into an object, merging "get" and "set" functions
function mergeProperty(target, name, desc, enumerable) {

    if (desc.get || desc.set) {

        var d$0 = { configurable: true };
        if (desc.get) d$0.get = desc.get;
        if (desc.set) d$0.set = desc.set;
        desc = d$0;
    }

    desc.enumerable = enumerable;
    Object.defineProperty(target, name, desc);
}

// Installs properties on an object, merging "get" and "set" functions
function mergeProperties(target, source, enumerable) {

    forEachDesc(source, function(name, desc) { return mergeProperty(target, name, desc, enumerable); });
}

// Builds a class
function buildClass(base, def) {

    var parent;

    if (def === void 0) {

        // If no base class is specified, then Object.prototype
        // is the parent prototype
        def = base;
        base = null;
        parent = Object.prototype;

    } else if (base === null) {

        // If the base is null, then then then the parent prototype is null
        parent = null;

    } else if (typeof base === "function") {

        parent = base.prototype;

        // Prototype must be null or an object
        if (parent !== null && Object(parent) !== parent)
            parent = void 0;
    }

    if (parent === void 0)
        throw new TypeError;

    // Create the prototype object
    var proto = Object.create(parent),
        statics = {};

    function __(target, obj) {

        if (!obj) mergeProperties(proto, target, false);
        else mergeProperties(target, obj, false);
    }

    __.static = function(obj) { return mergeProperties(statics, obj, false); };
    __.super = parent;
    __.csuper = base || Function.prototype;

    // Generate method collections, closing over super bindings
    def(__);

    var ctor = proto.constructor;

    // Set constructor's prototype
    ctor.prototype = proto;

    // Set class "static" methods
    forEachDesc(statics, function(name, desc) { return Object.defineProperty(ctor, name, desc); });

    // Inherit from base constructor
    if (base && ctor.__proto__)
        Object.setPrototypeOf(ctor, base);

    return ctor;
}

// The "_esdown" must be defined in the outer scope
_esdown = {

    version: VERSION,

    global: Global,

    class: buildClass,

    // Support for computed property names
    computed: function(target) {

        for (var i$2 = 1; i$2 < arguments.length; i$2 += 3) {

            var desc$0 = Object.getOwnPropertyDescriptor(arguments[i$2 + 1], "_");
            mergeProperty(target, arguments[i$2], desc$0, true);

            if (i$2 + 2 < arguments.length)
                mergeProperties(target, arguments[i$2 + 2], true);
        }

        return target;
    },

    // Support for tagged templates
    callSite: function(values, raw) {

        values.raw = raw || values;
        return values;
    },

    // Support for async functions
    async: function(iter) {

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
    },

    // Support for async generators
    asyncGen: function(iter) {

        var front = null, back = null;

        return _esdown.computed({

            next: function(val) { return send("next", val) },
            throw: function(val) { return send("throw", val) },
            return: function(val) { return send("return", val) },
            }, Symbol.asyncIterator, { _: function() { return this },
        });

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

        function fulfill(type, value) {

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

        function awaitValue(result) {

            var value = result.value;

            if (typeof value === "object" && "_esdown_await" in value) {

                if (result.done)
                    throw new Error("Invalid async generator return");

                return value._esdown_await;
            }

            return null;
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

                var result$1 = iter[type](value),
                    awaited$0 = awaitValue(result$1);

                if (awaited$0) {

                    Promise.resolve(awaited$0).then(
                        function(x) { return resume("next", x); },
                        function(x) { return resume("throw", x); });

                } else {

                    Promise.resolve(result$1.value).then(
                        function(x) { return fulfill(result$1.done ? "return" : "normal", x); },
                        function(x) { return fulfill("throw", x); });
                }

            } catch (x) {

                // HACK: Return-as-throw
                if (x && x.__return === true)
                    return fulfill("return", x.value);

                fulfill("throw", x);
            }
        }
    },

    // Support for spread operations
    spread: function(initial) {

        return {

            a: initial || [],

            // Add items
            s: function() {

                for (var i$3 = 0; i$3 < arguments.length; ++i$3)
                    this.a.push(arguments[i$3]);

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
            }

        };
    },

    // Support for object destructuring
    objd: function(obj) {

        return toObject(obj);
    },

    // Support for array destructuring
    arrayd: function(obj) {

        if (Array.isArray(obj)) {

            return {

                at: function(skip, pos) { return obj[pos] },
                rest: function(skip, pos) { return obj.slice(pos) }
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
            }
        };
    },

    // Support for private fields
    getPrivate: function(obj, map, name) {

        var entry = map.get(Object(obj));

        if (!entry)
            throw new TypeError;

        return entry[name];
    },

    setPrivate: function(obj, map, name, value) {

        var entry = map.get(Object(obj));

        if (!entry)
            throw new TypeError;

        return entry[name] = value;
    }

};


}).call(this);



var _M4 = {}, _M5 = {}, _M6 = {}, _M3 = {}, _M2 = {}, _M1 = exports;

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


}).call(this, _M4);

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


}).call(this, _M5);

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

        this.passed = 0;
        this.failed = 0;
        this.failList = [];
        this.path = [];
        this.margin = false;
    },

    get indent() {

        return " ".repeat(Math.max(this.path.length, 0) * 2);
    },

    end: function() { var __$2; 

        for (var __$0 = (this.failList)[Symbol.iterator](), __$1; __$1 = __$0.next(), !__$1.done;) { var path$0 = (__$2 = _esdown.objd(__$1.value), __$2.path), result$0 = __$2.result; 

            this._write(Style.bold(path$0 + " > " + result$0.name));
            this._write("  Actual: " + result$0.actual);
            this._write("  Expected: " + result$0.expected);
            this._newline();
        }
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


}).call(this, _M6);

(function(exports) {

var HtmlLogger = _M5.HtmlLogger;
var NodeLogger = _M6.NodeLogger;

var Logger = (typeof global === "object" && global.process) ?
    NodeLogger :
    HtmlLogger;

exports.Logger = Logger;


}).call(this, _M3);

(function(exports) {

var Test = _M4.Test;
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