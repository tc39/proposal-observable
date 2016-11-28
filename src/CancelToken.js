import Task from './Task';


export default class CancelToken {
  constructor(fn) {
    let promiseCancel;

    this._task = new Task((accept, reject) => {
      promiseCancel = accept;
    });

    this.promise = this._task.toPromise();

    let cancel = reason => {
      this.reason = reason;
      promiseCancel(reason);
    }

    fn(cancel);
  }

  throwIfRequested() {
    if (this.reason !== undefined) {
      throw this.reason;
    }
  }

  static source() {
    let cancel;
    let token = new CancelToken(cancelFn => {
      cancel = cancelFn;
    });

    return { cancel, token };
  }

  static race(cancelTokens) {
    return new CancelToken(cancel => {
      Task.race(cancelTokens.map(token => token._task)).then(cancel);
    });
  }
}
