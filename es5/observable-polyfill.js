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



var _M2 = {}, _M1 = exports;

(function(exports) {

// === Non-Promise Job Queueing ===

var enqueueJob = (function() {

    // Node
    if (typeof global !== "undefined" &&
        typeof process !== "undefined" &&
        process.nextTick) {

        return global.setImmediate ?
            function(fn) { global.setImmediate(fn) } :
            function(fn) { process.nextTick(fn) };
    }

    // Newish Browsers
    var Observer = self.MutationObserver || self.WebKitMutationObserver;

    if (Observer) {

        var div$0 = document.createElement("div"),
            twiddle$0 = function(_) { return div$0.classList.toggle("x"); },
            queue$0 = [];

        var observer$0 = new Observer(function(_) {

            if (queue$0.length > 1)
                twiddle$0();

            while (queue$0.length > 0)
                queue$0.shift()();
        });

        observer$0.observe(div$0, { attributes: true });

        return function(fn) {

            queue$0.push(fn);

            if (queue$0.length === 1)
                twiddle$0();
        };
    }

    // Fallback
    return function(fn) { setTimeout(fn, 0) };

})();

// === Symbol Polyfills ===

function polyfillSymbol(name) {

    if (!Symbol[name])
        Object.defineProperty(Symbol, name, { value: Symbol(name) });
}

polyfillSymbol("observable");

// === Abstract Operations ===

function getMethod(obj, key) {

    var value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function cleanupSubscription(observer) {

    // Assert:  observer._observer is undefined

    var cleanup = observer._cleanup;

    if (!cleanup)
        return;

    // Drop the reference to the cleanup function so that we won't call it
    // more than once
    observer._cleanup = undefined;

    // Call the cleanup function
    cleanup();
}

function subscriptionClosed(observer) {

    return observer._observer === undefined;
}

var SubscriptionObserver = _esdown.class(function(__) { var SubscriptionObserver;

    __({ constructor: SubscriptionObserver = function(observer, subscriber) {

        // Assert: subscriber is callable

        // The observer must be an object
        if (Object(observer) !== observer)
            throw new TypeError("Observer must be an object");

        this._observer = observer;
        this._cleanup = undefined;

        try {

            // Call the subscriber function
            var cleanup$0 = subscriber.call(undefined, this);

            // The return value must be undefined, null, or a function
            if (cleanup$0 != null && typeof cleanup$0 !== "function")
                throw new TypeError(cleanup$0 + " is not a function");

            this._cleanup = cleanup$0;

        } catch (e) {

            // If an error occurs during startup, then attempt to send the error
            // to the observer
            this.error(e);
            return;
        }

        // If the stream is already finished, then perform cleanup
        if (subscriptionClosed(this))
            cleanupSubscription(this);
    },

    cancel: function() {

        if (subscriptionClosed(this))
            return;

        this._observer = undefined;
        cleanupSubscription(this);
    },

    get closed() { return subscriptionClosed(this) },

    next: function(value) {

        // If the stream if closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        var observer = this._observer;

        try {

            var m$0 = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m$0)
                return undefined;

            // Send the next value to the sink
            return m$0.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            try { this.cancel() }
            finally { throw e }
        }
    },

    error: function(value) {

        // If the stream is closed, throw the error to the caller
        if (subscriptionClosed(this))
            throw value;

        var observer = this._observer;
        this._observer = undefined;

        try {

            var m$1 = getMethod(observer, "error");

            // If the sink does not support "error", then throw the error to the caller
            if (!m$1)
                throw value;

            value = m$1.call(observer, value);

        } catch (e) {

            try { cleanupSubscription(this) }
            finally { throw e }
        }

        cleanupSubscription(this);

        return value;
    },

    complete: function(value) {

        // If the stream is closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        var observer = this._observer;
        this._observer = undefined;

        try {

            var m$2 = getMethod(observer, "complete");

            // If the sink does not support "complete", then return undefined
            value = m$2 ? m$2.call(observer, value) : undefined;

        } catch (e) {

            try { cleanupSubscription(this) }
            finally { throw e }
        }

        cleanupSubscription(this);

        return value;
    }});

 });

// SubscriptionObserver instances should report Object as their constructor
// (see ArrayIterator and MapIterator).  Ideally, the prototype should not
// have an own constructor property, but for this polyfill we want to avoid
// using the delete operator.
SubscriptionObserver.prototype.constructor = Object;

var Observable = _esdown.class(function(__) { var Observable;

    // == Fundamental ==

    __({ constructor: Observable = function(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    },

    subscribe: function(observer) {

        // Wrap the observer in order to maintain observation invariants
        observer = new SubscriptionObserver(observer, this._subscriber);
        return function(_) { observer.cancel() };
    },

    forEach: function(fn) { var __this = this; 

        return new Promise(function(resolve, reject) {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            __this.subscribe({

                next: function(value) {

                    try { return fn(value) }
                    catch (x) { reject(x) }
                },

                error: reject,
                complete: resolve,
            });
        });
    }});

    __(_esdown.computed({}, Symbol.observable, { _: function() { return this } }));

    __.static(_esdown.computed({}, Symbol.species, { get _() { return this } }));

    // == Derived ==

    __.static({ from: function(x) {

        var C = typeof this === "function" ? this : Observable;

        if (x == null)
            throw new TypeError(x + " is not an object");

        var method = getMethod(x, Symbol.observable);

        if (method) {

            var observable$0 = method.call(x);

            if (Object(observable$0) !== observable$0)
                throw new TypeError(observable$0 + " is not an object");

            if (observable$0.constructor === C)
                return observable$0;

            return new C(function(observer) { return observable$0.subscribe(observer); });
        }

        return new C(function(observer) {

            enqueueJob(function(_) {

                if (observer.closed)
                    return;

                // Assume that the object is iterable.  If not, then the observer
                // will receive an error.
                try {

                    for (var __$0 = (x)[Symbol.iterator](), __$1; __$1 = __$0.next(), !__$1.done;) { var item$0 = __$1.value; 

                        observer.next(item$0);

                        if (observer.closed)
                            return;
                    }

                } catch (x) {

                    // If observer.next throws an error, then the subscription will
                    // be closed and the error method will simply rethrow
                    observer.error(x);
                    return;
                }

                observer.complete();
            });
        });
    },

    of: function() { for (var items = [], __$0 = 0; __$0 < arguments.length; ++__$0) items.push(arguments[__$0]); 

        var C = typeof this === "function" ? this : Observable;

        return new C(function(observer) {

            enqueueJob(function(_) {

                if (observer.closed)
                    return;

                for (var i$0 = 0; i$0 < items.length; ++i$0) {

                    observer.next(items[i$0]);

                    if (observer.closed)
                        return;
                }

                observer.complete();
            });
        });
    }});

    __({ map: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = this.constructor[Symbol.species];

        return new C(function(observer) { return __this.subscribe({

            next: function(value) {

                try { value = fn(value) }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error: function(value) { return observer.error(value) },
            complete: function(value) { return observer.complete(value) },
        }); });
    },

    filter: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = this.constructor[Symbol.species];

        return new C(function(observer) { return __this.subscribe({

            next: function(value) {

                try { if (!fn(value)) return undefined; }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error: function(value) { return observer.error(value) },
            complete: function(value) { return observer.complete(value) },
        }); });
    }});

 });

exports.Observable = Observable;


}).call(this, _M2);

(function(exports) {

var Observable = _M2.Observable;

var G = (function(_) {
    try { return self.self } catch (e) {}
    try { return global.global } catch (e) {}
    return {};
})();

try {

    if (typeof G.Observable.prototype.subscribe !== "function")
        throw null;

} catch (e) { G.Observable = Observable }


}).call(this, _M1);


}, [], "");