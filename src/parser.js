const A = require("arcsecond");

function pluginLoader(plugins) {
  const fieldOrBlockParser = A.choice([
    A.str("@@"),
    A.char("@")
  ])
    .map((x) => (x === "@" ? "field" : "block"))
    .errorMap((err) => {
      return `ParseError (position ${err.index}): Expected '@' for field method or '@@' for block method`
    })


  return A.coroutine(function* () {
    // Get field @ or block @@
    const fieldOrBlock = yield fieldOrBlockParser;

    // Get a namespace 
    const namespace = yield A.sequenceOf([
      A.letters,
      A.char(".")
    ]).map((x) => x[0]);

    const validNamespaces = plugins.reduce((acc, plugin) => ([...acc, plugin.namespace]), []);

    // Is a valid namespace?
    const isValidNamespace = validNamespaces.includes(namespace);
    if (!isValidNamespace)
      yield A.fail(`Namespace '${namespace}' is not registered by any loaded plugin, valid ones [${validNamespaces.join(", ")}]`)

    // Get a method
    const methodName = yield A.letters;

    // From namespace get target plugin
    const plugin = plugins.find((plugin) => plugin.namespace === namespace);
    // Get methods for this plugin
    const validMethodNames = Object.keys(plugin.methods);

    // Is a valid method?
    const isValidMethodName = validMethodNames.includes(methodName);
    if (!isValidMethodName)
      yield A.fail(`Method '${methodName}' is not a registered method in the namespace '${namespace}', valid ones [${validMethodNames.join(", ")}]`);

    const method = plugin.methods[methodName];

    const validContexts = Object.entries(method.targets).filter((target) => target[1]).map((targetArr) => targetArr[0]);
    // Check if method admits current fieldOrBlock
    if (!method.targets[fieldOrBlock])
      yield A.fail(`'${namespace}.${methodName}' cannot be used in the context of '${fieldOrBlock}', valid contexts [${validContexts.join(", ")}]`);

    let parameters = null;

    const rawParameters = yield rawParametersParser();
    if (rawParameters !== null)
      // parametersValidator(rawParameters, method)
      parameters = rawParameters;

    // If no properties defined, we do not accept any properties
    if (Object.keys(method.parameters).length === 0 && rawParameters !== null)
      yield A.fail(`'${namespace}.${methodName}' does not accept any parameters, parenthesis must be omitted`);

    if (rawParameters !== null && rawParameters.length === 0)
      yield A.fail(`'${namespace}.${methodName}' has no given parameters, parenthesis must be omitted`)

    const givenKeys = rawParameters === null ? [] : rawParameters.reduce((acc, parameter) => {
      acc.push(parameter.key);
      return acc;
    }, []);

    const requiredKeys = [];
    const allKeys = [];
    for (const parameterKey of Object.keys(method.parameters)) {
      const options = method.parameters[parameterKey];
      allKeys.push(parameterKey);
      if (options.required)
        requiredKeys.push(parameterKey);
    }


    let requiredKeysSeen = [];
    for (const [i, { key, value }] of (rawParameters === null ? [] : rawParameters).entries()) {
      // Check for duplicates
      if (givenKeys.indexOf(key) !== givenKeys.lastIndexOf(key))
        yield A.fail(`key '${key}' is duplicated`);

      // Check for undefined keys
      if (!allKeys.includes(key))
        yield A.fail(`key '${key}' is not defined for this method`);

      // Check types
      const expectedType = method.parameters[key].type;
      if (expectedType.endsWith("[]")) {
        // Array
        const expectedArrayType = expectedType.replace("[]", "");

        if (value.type === "array") {
          for (const [i, item] of value.value.entries()) {
            if (item.type !== expectedArrayType && expectedArrayType !== "any")
              yield A.fail(`key '${key}[${i}]' is of type '${item.type}' but we expect '${expectedType}' to have only '${expectedArrayType}'`);
          }
        } else {
          if (value.type !== expectedArrayType && expectedArrayType !== "any")
            yield A.fail(`key '${key}[0]' is of type '${value.type}' but we expect '${expectedType}' to have only '${expectedArrayType}'`);
          const copyOfValue = { ...value };
          value.type = "array";
          value.value = copyOfValue;
        }

      } else {
        // Primitive
        if (value.type !== expectedType && expectedType !== "any")
          yield A.fail(`key '${key}' is of type '${value.type}' but we expect '${expectedType}'`);
      }

      if (requiredKeys.includes(key))
        requiredKeysSeen.push(key);
    }

    // Check that all required are given
    const requiredKeysDifference = requiredKeys.filter(x => !requiredKeysSeen.includes(x));
    if (requiredKeysDifference.length !== 0)
      yield A.fail(`keys [${requiredKeysDifference.join(", ")}] are required but aren't given`);

    return { context: fieldOrBlock, namespace, method: methodName, parameters };
  })
}

function rawParametersParser() {
  const anyParser = A.recursiveParser(() => A.choice([
    boolParser,
    numberParser,
    strParser,
    anyArrayParser
  ]));

  const quoteParser = A.char(`"`);

  const boolParser = A.pipeParsers([
    A.choice([
      A.str("true"), A.str("false")
    ]),
    A.mapTo(x => ({ true: true, false: false })[x])
  ])
    .map(x => {
      return {
        type: "boolean",
        value: x
      }
    })

  const arrayParser = (valParser) => A.between(A.char("["))(A.char("]"))(
    A.sepBy(A.char(","))(A.pipeParsers([
      A.namedSequenceOf([
        [null, A.optionalWhitespace],
        ["value", valParser],
        [null, A.optionalWhitespace]
      ]),
      A.mapTo(({ value }) => value)
    ])
    )).map(x => {
      return {
        type: "array",
        value: x
      };
    })

  const anyArrayParser = arrayParser(anyParser);

  const strParser = A.pipeParsers([
    A.between(quoteParser)(quoteParser)(
      A.many(A.anythingExcept(quoteParser).map(x => String.fromCharCode(x)))
    ),
    A.mapTo(x => x.join(""))
  ])
    .map(x => {
      return {
        type: "string",
        value: x
      }
    });

  const intParser = A.pipeParsers([
    A.many1(A.digit),
    A.mapTo(digits => (Number(digits.join(""))))
  ])

  const floatParser = A.pipeParsers([
    A.sequenceOf([
      intParser,
      A.char('.'),
      A.many1(A.digit)
    ]),
    A.mapTo(([integer, _, fraction]) =>
      (Number(`${integer}.${fraction.join("")}`))
    )
  ])

  const numberParser = A.choice([floatParser, intParser])
    .map((x) => {
      return {
        type: "number",
        value: x
      };
    });

  const keyParser = A.many(A.anythingExcept(A.char(":")).map(x => String.fromCharCode(x))).map(x => x.join(""));

  return A.coroutine(function* () {

    const outParameters = [];

    const peek = yield A.possibly(A.char("("));

    if (peek === null) {
      // No opening? return null as we don't have arguments
      return null;
    }

    yield A.optionalWhitespace;
    const unnamedParammeter = yield A.either(anyParser);
    yield A.optionalWhitespace;

    if (!unnamedParammeter.isError) {
      outParameters.push({
        key: "_",
        value: unnamedParammeter.value
      })

      yield A.optionalWhitespace;

      const commaSeparator = yield A.either(A.char(","));


      if (commaSeparator.isError)
        return outParameters;

    }

    const namedParameters = yield A.sepBy(A.char(","))(
      A.namedSequenceOf([
        [null, A.optionalWhitespace],
        ["key", keyParser],
        [null, A.optionalWhitespace],
        [null, A.char(":")],
        [null, A.optionalWhitespace],
        ["value", anyParser],
        [null, A.optionalWhitespace],
      ]).map(x => {
        delete x["null"];
        return x;
      })
    )
    outParameters.push(...namedParameters);

    yield A.char(")");

    return outParameters;
  })
}

module.exports = pluginLoader;