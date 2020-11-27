# Attribute parser for plugin system

This attribute parser implements the [Prisma spec](https://github.com/prisma/specs/tree/master/schema#attributes) for attributes and expands it with type checking and signature validation.

## Plugin config

Example usage:
```js
const pluginLoader = require("./src");

const validatorPluginConfig = {
  namespace: "Validator",
  methods: {
    IsEmail: {
      targets: {
        field: true,
        block: false
      },
      parameters: {}
    },
    Min: {
      targets: {
        field: true,
        block: false
      },
      parameters: {
        _: {
          type: "number",
          required: true
        },
        message: {
          type: "string",
          required: false
        }
      }
    }
  }
}

const TypeGraphQLPluginConfig = {
  // [...]
}

const parser = pluginLoader([validatorPluginConfig, TypeGraphQLPluginConfig]);

const parsed = parser.run(`@Validator.Min(30, "Password must be atleast 30 characters long")`);

console.log(JSON.stringify(parsed, null, 2));
{
  "isError": false,
  "result": {
    "type": "attribute",
    "value": {
      "context": "field",
      "namespace": "Validator",
      "method": "Min",
      "parameters": [
        {
          "key": "_",
          "value": {
            "type": "number",
            "value": 30
          }
        },
        {
          "key": "message",
          "value": {
            "type": "string",
            "value": "Password must be atleast 30 characters long"
          }
        }
      ]
    }
  },
  "index": 74,
  "data": null
}
```

The namespace will appear after the field or block attribute switch.

So for example to use the `IsEmail` method you have to write:

`@Validator.IsEmail`

First appears the field or block selector, the configuration in this case says that it can only be attributed to fields, so if two `@@` are ussed a parse error will appear:

```
> @@Validator.IsEmail
< 'Validator.IsEmail' cannot be used in the context of 'block', valid contexts [field]
```

If the namespace doesn't exist:

```
> @Authorization.Grant("user")
< Namespace 'Authorization' is not registered by any loaded plugin, valid ones [TypeGraphQL, Validator]
```


If the method doesn't exist:

```
> @Validator.IsURI
< Method 'IsURI' is not a registered method in the namespace 'Validator', valid ones [IsEmail, Min]
```

Plugins must configure each method signature with:

- If the argument is required or not
- The type of the argument

By the looks of the [Prisma spec](https://github.com/prisma/specs/tree/master/schema#attributes) valid types for the oficial spec are `boolean`, `number`, `string` and the equivalent array ones (`boolean[]`, `number[]`, `string[]`). there is also `any` and `any[]` for when we don't want to force a type.

## Method arguments

There may be any number of named arguments. If there is a positional argument, if it's present and required, the caller must place it before any named arguments. Named arguments may appear in any order:

```
@@pg.index([ email, first_name ], name: "my_index", partial: true)
@@pg.index([ first_name, last_name ], unique: true, name: "my_index")
@pg.numeric(precision: 5, scale: 2)
@Validator.Min(10, message: "Password must be atleast 10 characters long")
```

methods with arguments with the same name will cause an error:

```
> @Validator.Min(55, message: "hello", message: "there")
< key 'message' is duplicated
```

Arrays with a single parameter, you may omit the surrounding brackets, the parser will wrap the result in an array if the type validates correctly as if it was an item of it:

```js
// [...]
const parsed = parser.run(`@Fox.test(arg: "hello")`);

console.log(JSON.stringify(parsed, null, 2));
{
  "isError": false,
  "result": {
    "type": "attribute",
    "value": {
      "context": "field",
      "namespace": "Fox",
      "method": "Test",
      "parameters": [
        {
          "key": "arg",
          "value": {
            "type": "array",
            "value": {
              "type": "string",
              "value": "hello"
            }
          }
        }
      ]
    }
  },
  "index": 23,
  "data": null
}
```

Error if another type is given:

```
> @Fox.Test(arg: 42)
< "key 'arg[0]' is of type 'number' but we expect 'string[]' to have only 'string'
```

## Documentation comments

Documentation comments are also parsed
```js
// [...]
const parsed = parser.run(`this is a documentation comment`);

console.log(JSON.stringify(parsed, null, 2));
{
  "isError": false,
  "result": {
    "type": "documentation",
    "value": "this is a documentation comment"
  },
  "index": 31,
  "data": null
}
```