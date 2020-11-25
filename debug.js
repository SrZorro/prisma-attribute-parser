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
          type: "boolean[]",
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
          required: true
        },
        key: {
          type: "any[]",
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
    debug: {}
  }
}

const parser = pluginLoader([TypeGraphQLConfig, validatorPluginConfig, foxPluginConfig]);
console.log(JSON.stringify(parser.run(`@Fox.Test(55, key: false)`), null, 2));
// const out = parser.run(`@Validator.IsEmail`);
// console.log(out);