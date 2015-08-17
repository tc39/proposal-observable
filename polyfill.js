import { Observable } from "./src/Observable.js";

let G = (_=> {
    try { return self.self } catch (e) {}
    try { return global.global } catch (e) {}
    return {};
})();

try {

    if (typeof G.Observable.prototype.subscribe !== "function")
        throw null;

} catch (e) { G.Observable = Observable }
