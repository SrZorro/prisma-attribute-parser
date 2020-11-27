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

const foxPluginConfig = {
  namespace: "Fox",
  methods: {
    Test: {
      targets: {
        field: true,
        block: false
      },
      parameters: {
        _: {
          type: "number",
          required: false
        },
        arg: {
          type: "string[]",
          required: false
        }
      }
    }
  }
}

// Parameters can be: string, number, boolean or array (or any)
const TypeGraphQLConfig = {
  namespace: "TypeGraphQL",
  methods: {
    debug: {
      targets: {
        field: true,
        block: false
      },
      parameters: {}
    }
  }
}

const parser = pluginLoader([TypeGraphQLConfig, validatorPluginConfig, foxPluginConfig]);
// console.log(JSON.stringify(parser.run(`jamon serrano`), null, 2));
// console.log(JSON.stringify(parser.run(`@TypeGraphQL.debug`), null, 2));
// console.log(JSON.stringify(parser.run(`@Validator.Min(30, message: "Password must be atleast 30 characters long")`), null, 2));
// console.log(JSON.stringify(parser.run(`this is a documentation comment`), null, 2));
// console.log(JSON.stringify(parser.run(`@Fox.Test(55, key: false)`), null, 2));
// console.log(JSON.stringify(parser.run(`@Fox.Test(arg: "hello")`), null, 2));
// const out = parser.run(`@Validator.IsEmail`);
// console.log(out);