## Implementing EventTarget with Observable ##


### Changes to Event Dispatch ###

To invoke the event listeners for an object with an event run these steps:

1. Let *event* be the event for which the event listeners are invoked.
1. Let *observers* be a copy of the event listeners associated with the object for which
   these steps are run.
1. Initialize *event*'s currentTarget attribute to the object for which these steps are
   run.
1. Then run these substeps for each event *listener* in *listeners*:
    1. If *event*'s stop immediate propagation flag is set, terminate the **invoke**
       algorithm.
    1. Let *listener* be the event listener.
    1. If *event*'s type attribute value is not *listener*'s type, terminate these substeps
       (and run them for the next event listener).
    1. If *event*'s eventPhase attribute value is **CAPTURING_PHASE** and listener's
       capture is **false**, terminate these substeps (and run them for the next event
       listener).
    1. If *event*'s eventPhase attribute value is **BUBBLING_PHASE** and listener's
       capture is **true**, terminate these substeps (and run them for the next event
       listener).
    1. Let *observer* be the *listener*'s observer.
    1. Invoke the `next` method of *observer*, with the event passed to this algorithm
       as the first argument.  If this throws any exception, report the exception.

### EventTarget Implementation in JavaScript ###

```js
class EventTarget {

    @listeners = [];
    @handlers = [];

    observe(type, capture = false) {

        return new Observable(observer => {

            // On subscription, add a listener
            this.@listeners.push({ observer, type, capture });

            // On unsubscription, remove the listener
            return _=> {

                let index = this.@listeners.find(
                    listener => listener.observer === observer);

                if (index >= 0)
                    this.@listeners.splice(index, 1);
            };
        });
    }

    addEventListener(type, handler, capture = false) {

        let index = this.@findHandler(type, handler, capture);

        // Dedupe:  exit if listener is already registered
        if (index >= 0)
            return;

        let cancel = this.observe(type, capture).subscribe({
            next(event) { handler.call(event.currentTarget, event) }
        });

        this.@handlers.push({ type, handler, capture, cancel });
    }

    removeEventListener(type, handler, capture = false) {

        let index = this.@findHandler(type, handler, capture);

        // Exit if listener is not registered
        if (index < 0)
            return;

        this.@handlers[index].cancel();
        this.@handlers.splice(index, 1);
    }

    @findHandler(type, handler, capture) {

        return this.@handlers.findIndex(x =>
            x.type === x.type &&
            x.handler === handler &&
            x.capture === capture);
    }

}
```
