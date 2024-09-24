import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";

export default [
  {
    ignores: [
      ".*.js",
      ".*.mjs",
      "coverage/*",
      "_templates/*",
      "lib/*",
      "dist/*",
      "node_modules/*",
    ],
  },

  // Base JS config
  js.configs.recommended,

  // Base TS config
  ...tseslint.configs.recommended,

  // Prettier recommended
  eslintPluginPrettierRecommended,

  // MJS files in scripts folder (have access to ZX globals)
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
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
    },
  },

  {
    files: ["**/*.tsx"],
    plugins: {
      react: eslintPluginReact,
      "react-hooks": fixupPluginRules(eslintPluginReactHooks),
    },
    rules: {
      ...eslintPluginReact.configs.flat.recommended.rules,
      ...eslintPluginReactHooks.configs.recommended.rules,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
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
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
