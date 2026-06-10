import config, { nodeRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  ...nodeRuntimeOverrides,
  {
    ignores: ["eslint.config.mjs", "vitest.*.mjs", "scripts/*.mjs", "lib/*"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["off"],
    },
  },
];
