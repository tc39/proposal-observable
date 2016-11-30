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
                            observer.next(value);
                        },
                        catch(e) {
                            innerObservables--;
                            observer.throw(e);
                        },
                        complete(v) {
                            innerObservables--;
                            if (innerObservables === 0 && outerObservableDone) {
                                observer.complete(v);
                            }
                        }
                    },
                    token);
            },
            catch(e) {
                observer.throw(e);
            },
            complete(v) {
                outerObservableDone = true;
                if (innerObservables === 0) {
                    observer.complete(v);
                }
            }
        },
        token);
    });
}

function switch(observable) {
    return new Observable((observer, token) => {
        let outerObservableDone = false;
        let innerCancel;

        observable.subscribe({
            next(innerObservable) {
                if (innerCancel) {
                    innerCancel(new Cancel());
                    innerCancel = null;
                }

                let { preInnerToken: token, preInnerCancel: cancel } = CancelToken.source();
                let innerToken = CancelToken.race([token, preInnerToken]);
                innerCancel = preInnerCancel;

                innerObservable.subscribe(
                    {
                        next(value) {
                            observer.next(value);
                        },
                        catch(e) {
                            observer.throw(e);
                        },
                        complete(v) {
                            innerCancel = null;
                            if (outerObservableDone) {
                                observer.complete(v);
                            }
                        }
                    },
                    innerToken);
            },
            catch(e) {
                observer.throw(e);
            },
            complete(v) {
                outerObservableDone = true;
                if (innerCancel == null) {
                    observer.complete(v);
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

                observer.next(value);
            },
            catch(e) {
                observer.throw(e);
            },
            complete(e) {
                observer.complete(e);
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
                    observer.next(value);
                }
            },
            catch(e) {
                observer.throw(e);
            },
            complete(e) {
                observer.complete(e);
            }
        })
    });
}

var { token, cancel } = CancelToken.source();

flatten(map(filter(Observable.of(1,2,3,4), x => x > 2), x => Observable.of(9,10,11))).forEach(v => console.log(v)).then(() => console.log("COMPLETE"), e => console.error("ERROR"));
