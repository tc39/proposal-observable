new Function("this.global = this")();
function ENQUEUE_MICROTASK(fn) { %EnqueueMicrotask(fn) }
