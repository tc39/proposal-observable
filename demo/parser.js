// A sequence of token objects
const TOKENS = [

    { type: "NUMBER", value: 123 },
    { type: "+" },
    { type: "NUMBER", value: 89 },
    { type: "*" },
    { type: "NUMBER", value: 76 },
];

// Returns an observable sequence of token objects
function tokenStream() {

    return new Observable(sink => {

        for (let t of TOKENS)
            sink.next(t);

        sink.return();
    });
}

// Returns an observable which outputs an AST from an input observable of token objects
function parse(tokenStream) {

    let current = null;

    function* peek() {

        if (current === null)
            current = yield;

        return current;
    }

    function* eat(type = "") {

        let token = yield * peek();

        if (type && token.type !== type)
            throw new SyntaxError("Expected " + type);

        current = null;
        return token;
    }

    function* parseAdd() {

        let node = yield * parseMultiply();

        while ((yield * peek()).type === "+") {

            yield * eat();
            let right = yield * parseMultiply()
            node = { type: "+", left: node, right, value: node.value + right.value };
        }

        return node;
    }

    function* parseMultiply() {

        let node = yield * eat("NUMBER");

        while ((yield * peek()).type === "*") {

            yield * eat();
            let right = yield * eat("NUMBER");
            node = { type: "*", left: node, right, value: node.value * right.value };
        }

        return node;
    }

    function* start() {

        let ast = yield * parseAdd();
        yield * eat("EOF");
        return ast;
    };

    return new Observable(sink => {

        let generator = start();
        generator.next();

        return tokenStream.subscribe({

            next(x) {

                let result;

                try { result = generator.next(x) }
                catch (x) { return sink.throw(x) }

                if (result.done)
                    sink.return(result.value);

                return result;
            },

            throw(x) { return sink.throw(x) },
            return() { return this.next({ type: "EOF" }) },
        });
    });
}

parse(tokenStream()).subscribe({
    return(ast) { console.log(ast) },
    throw(error) { console.log(error) },
});
