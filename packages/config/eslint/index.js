const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended", "prettier", "turbo"],
  plugins: ["only-warn", "simple-import-sort"],
  globals: {
    React: true,
    JSX: true,
    node: true,
    console: true,
  },
  env: {
    es6: true,
  },
  ignorePatterns: [
    // Ignore dotfiles
    ".*.js",
    "node_modules/",
    "dist/",
    "lib/",
  ],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      parser: "@typescript-eslint/parser",
      extends: [
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:@typescript-eslint/stylistic-type-checked",
        "prettier",
      ],
      rules: {
        "import/prefer-default-export": "off",
        "no-void": "off",
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        "@typescript-eslint/consistent-type-definitions": "off",
        "@typescript-eslint/ban-ts-comment": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-shadow": "warn",
        "@typescript-eslint/require-await": "warn",
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-return": "warn",
        "@typescript-eslint/no-unsafe-call": "warn",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
      },
    },
    {
      files: ["**/*.mjs"],
      env: {
        es6: true,
        node: true,
      },
      globals: {
        log: true,
        $: true,
        argv: true,
        cd: true,
        chalk: true,
        echo: true,
        expBackoff: true,
        fs: true,
        glob: true,
        globby: true,
        nothrow: true,
        os: true,
        path: true,
        question: true,
        quiet: true,
        quote: true,
        quotePowerShell: true,
        retry: true,
        sleep: true,
        spinner: true,
        ssh: true,
        stdin: true,
        which: true,
        within: true,
      },
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module",
      },
    },
  ],
};
