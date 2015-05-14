## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- Compositional: Observables can be composed with higher-order combinators.
- Lazy: Observables do not start emiting data until an **observer** is subscribed.
- Efficient: Data is sent to observers using direct function calls.
- Integrated with ES6: Data is sent to consumers using the ES6 generator interface.

The **Observable** concept comes from *reactive programming*.  See http://reactivex.io/
for more information.

### Example: Observing Keyboard Events ###

Using the **Observable** constructor, we can create a function which returns an
observable stream of events for an arbitrary DOM element and event type.

```js
function listen(element, eventName) {
    return new Observable(sink => {
        // Create an event handler which sends data to the sink
        let handler = event => sink.next(event);

        // Attach the event handler
        element.addEventListener(eventName, handler, true);

        // Return a function which will cancel the event stream
        return _ => {
            // Detach the event handler from the element
            element.removeEventListener(eventName, handler, true);

            // Terminate the stream
            sink.return();
        };
    });
}
```

We can then use standard combinators to filter and map the events in the stream,
just like we would with an array.

```js
// Return an observable of special key down commands
function commandKeys(element) {
    let keyCommands = { "38": "up", "40": "down" };

    return listen(element, "keydown")
        .filter(event => event.keyCode in keyCommands)
        .map(event => keyCommands[event.keyCode])
}
```

When we want to consume the event stream, we subscribe with an **observer**.

```js
commandKeys(inputElement).subscribe({
    next(value) { console.log("Recieved key command: " + value) },
    throw(error) { console.log("Recieved an error: " + error) },
    return() { console.log("Stream complete") },
});
```

Because observers implement the generator interface, we can use a generator function
to consume the stream.

```js
function consumer() {
    let generator = function*() {
        while (true) {
            console.log("Recieved key command: " + (yield));
        }
    }();

    // "Prime" the generator so that it can receive the first value from the producer
    generator.next();
    return generator;
}

commandKeys(inputElement).subscribe(consumer());
```

