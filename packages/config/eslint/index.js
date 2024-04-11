const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended", "prettier", "turbo"],
  plugins: ["simple-import-sort"],
  globals: {
    React: true,
    JSX: true,
    node: true,
    console: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
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
        "no-restricted-syntax": [
          "error",
          {
            selector: "ExportDefaultDeclaration",
            message: "Prefer named exports",
          },
        ],
        "no-void": "off",
        "no-restricted-imports": [
          "error",
          {
            patterns: ["../*"],
          },
        ],
        "simple-import-sort/imports": [
          "error",
          {
            groups: [
              // Side effect imports.
              ["^\\u0000"],
              // Node.js builtins prefixed with `node:`.
              ["^node:"],
              // Packages. `react` related packages come first.
              ["^react", "^@?\\w"],
              // Internal packages.
              ["^(@|@api|@internal|@root)(/.*|$)"],
              // Other relative imports. Put same-folder imports and `.` last.
              ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
              // Style imports.
              ["^.+\\.s?css$"],
            ],
          },
        ],
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
  ],
};
