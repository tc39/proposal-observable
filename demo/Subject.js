import { Observable } from '../src/Observable';

class Subject extends Observable {
  constructor() {
    super((observer, token) => {
      this._observers.add(observer);
    });

    token.promise.then(() => this._observers.delete(observer));
    this._observers = new Set();
  }

  _multicast(msg, value) {
    const observers = Array.from(this._observers);
    for(let observer of observers) {
      observer[msg](value);
    }
    return undefined;
  }

  next(value) {
    return this._multicast("next", value);
  }

  error(error) {
    return this._multicast("error", error);
  }

  complete(value) {
    return this._multicast("complete", value);
  }
}
