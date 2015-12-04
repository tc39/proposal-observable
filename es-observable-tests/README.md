## ECMAScript Observable Tests ##

To run the unit tests, install the **es-observable-tests** package into your project.

```
npm install es-observable-tests
```

Then call the exported `runTests` function with the constructor you want to test.

```js
require("es-observable-tests").runTests(MyObservable);
```
