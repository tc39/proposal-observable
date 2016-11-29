import { Observable } from '../src/Observable';
import CancelToken from '../src/CancelToken';

function flatten(observable) {
    return new Observable((observer, token) => {
        let outerObservableDone = false;
        let innerObservables = 0;

        observable.subscribe({
            next(innerObservable) {
                innerObservables++;

                innerObservable.subscribe(
                    {
                        next(value) {
                            return observer.next(value);
                        },
                        catch(e) {
                            innerObservables--;
                            return observer.throw(e);
                        },
                        complete(v) {
                            innerObservables--;
                            if (innerObservables === 0 && outerObservableDone) {
                                return observer.complete(v);
                            }
                        }
                    },
                    token);
            },
            catch(e) {
                return observer.throw(e);
            },
            complete(v) {
                outerObservableDone = true;
                if (innerObservables === 0) {
                    return observer.complete(v);
                }
            }
        },
        token);
    });
}

function map(observable, projection) {
    return new Observable((observer, token) => {
        observable.subscribe({
            next(value) {
                try {
                    value = projection(value);
                }
                catch(e) {
                    return observer.throw(e);
                }

                return observer.next(value);
            },
            catch(e) {
                return observer.throw(e);
            },
            complete(e) {
                return observer.complete(e);
            }
        });
    });
}

function filter(observable, predicate) {
    return new Observable((observer, token) => {
        observable.subscribe({
            next(value) {
                let include;
                try {
                    include = predicate(value);
                }
                catch(e) {
                    return observer.throw(e);
                }

                if (include) {
                    return observer.next(value);
                }
            },
            catch(e) {
                return observer.throw(e);
            },
            complete(e) {
                return observer.complete(e);
            }
        })
    });
}


var {token, cancel} = CancelToken.source();

flatten(map(filter(Observable.of(1,2,3,4), x => x > 2), x => Observable.of(9,10,11))).forEach(v => console.log(v)).then(() => console.log("COMPLETE"), e => console.error("ERROR"));
