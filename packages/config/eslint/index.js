import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";

const productionSourceFiles = ["**/*.ts", "**/*.tsx"];

const productionSourceIgnores = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/__fixtures__/**",
];

const relativeImportRestrictions = { patterns: ["../*"] };

const nodeOnlyGlobalRestrictions = [
  {
    name: "Buffer",
    message:
      "Not portable. Use Uint8Array + byte/hex helpers (see signer-utils).",
  },
  { name: "__dirname", message: "Node-only." },
  { name: "__filename", message: "Node-only." },
  { name: "global", message: "Use globalThis if truly needed." },
  {
    name: "setImmediate",
    message: "Node-only; use queueMicrotask/setTimeout.",
  },
];

const processGlobalRestriction = {
  name: "process",
  message: "Node-only global; not available in browser/RN/Hermes.",
};

// `atob`/`btoa` exist in browsers, Node and Hermes, but each runtime exposes a
// different preferred entry point (window.atob, Buffer, the bare global...).
// Rather than special-casing every runtime, route all Base64 work through the
// shared, portable helpers, which pick the right implementation internally.
const base64GlobalRestrictions = [
  {
    name: "atob",
    message:
      "Not portable. Decode Base64 via base64StringToBuffer from @ledgerhq/device-management-kit (returns Uint8Array | null).",
  },
  {
    name: "btoa",
    message:
      "Not portable. Encode bytes via bufferToBase64String from @ledgerhq/device-management-kit.",
  },
];

const problematicWebGlobalRestrictions = [
  {
    name: "URL",
    message:
      "React Native URL.toString() appends a stray trailing slash (#1484); build URL strings manually.",
  },
  {
    name: "URLSearchParams",
    message:
      "URLSearchParams.set missing on some React Native versions (#1467); serialize manually.",
  },
  {
    name: "Blob",
    message:
      "Not guaranteed in React Native/Hermes; guard with typeof before use.",
  },
  {
    name: "FormData",
    message:
      "Not guaranteed in React Native/Hermes; guard with typeof before use.",
  },
  {
    name: "ReadableStream",
    message:
      "Not guaranteed in React Native/Hermes; guard with typeof before use.",
  },
];

const abortSignalPropertyRestrictions = [
  {
    object: "AbortSignal",
    property: "timeout",
    message:
      "Not guaranteed in React Native/Hermes; build the signal using AbortController.",
  },
  {
    object: "AbortSignal",
    property: "any",
    message:
      "Not guaranteed in React Native/Hermes; build the signal using AbortController.",
  },
];

const nodeBuiltinImportRestrictions = [
  "crypto",
  "stream",
  "fs",
  "path",
  "buffer",
  "os",
  "util",
  "events",
  "http",
  "https",
  "zlib",
  "child_process",
  "net",
  "tls",
  "dns",
].map((name) => ({
  name,
  message: `Node built-in "${name}" is not portable. Use @noble/hashes for hashing, Uint8Array/DataView for bytes.`,
}));

const portableImportRestrictions = {
  patterns: [...relativeImportRestrictions.patterns, "node:*"],
  paths: nodeBuiltinImportRestrictions,
};

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

  // MJS, CJS files have access to ZX globals
  {
    files: ["**/*.mjs", "**/*.cjs"],
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
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
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
      "@typescript-eslint/no-floating-promises": "warn",
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
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/command/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@ledgerhq/device-management-kit",
              importNames: ["CommandResultFactory"],
              message: "Use DmkResultFactory outside the command layer.",
            },
          ],
        },
      ],
    },
  },

  // Portable-runtime API ban: shared/runtime packages
  // must not rely on Node-only or proven-problematic Web globals/imports, so
  // packages stay consumable across Node, browsers, React Native and Hermes.
  // Node-only packages/apps opt out via `nodeRuntimeOverrides` (see below).
  {
    files: productionSourceFiles,
    ignores: productionSourceIgnores,
    // Re-declared in full: flat config replaces (not merges) rule options for
    // the most specific matching block, so the base `../*` ban must be repeated
    // here alongside the portable-runtime bans.
    rules: {
      "no-restricted-globals": [
        "error",
        ...nodeOnlyGlobalRestrictions,
        processGlobalRestriction,
        ...problematicWebGlobalRestrictions,
        ...base64GlobalRestrictions,
      ],
      "no-restricted-properties": ["error", ...abortSignalPropertyRestrictions],
      "no-restricted-imports": ["error", portableImportRestrictions],
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
];

// Opt-out for Node-only packages/apps (transports, CLIs, build tools, servers,
// and environment-specific apps). Spread this AFTER the default config to
// disable the portable-runtime API ban while keeping the base `../*` import
// restriction in place.
export const nodeRuntimeOverrides = [
  {
    files: productionSourceFiles,
    ignores: productionSourceIgnores,
    rules: {
      // Node globals are allowed, but `atob`/`btoa` stay banned so Base64 work
      // keeps going through the shared, portable helpers.
      "no-restricted-globals": ["error", ...base64GlobalRestrictions],
      "no-restricted-properties": "off",
      "no-restricted-imports": ["error", relativeImportRestrictions],
    },
  },
];

// Opt-out for browser/app packages where platform globals are expected at the
// application boundary (for example sample apps and devtools UI). Shared
// runtime packages should not use this override.
export const webRuntimeOverrides = [
  {
    files: productionSourceFiles,
    ignores: productionSourceIgnores,
    rules: {
      // Browser/app packages can use Web globals at the application boundary.
      // `process.env` is also common in web app toolchains at build time.
      "no-restricted-globals": [
        "error",
        ...nodeOnlyGlobalRestrictions,
        ...base64GlobalRestrictions,
      ],
      "no-restricted-properties": "off",
      "no-restricted-imports": ["error", portableImportRestrictions],
    },
  },
];
