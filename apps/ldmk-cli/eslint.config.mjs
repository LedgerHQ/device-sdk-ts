import config, { nodeRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  ...nodeRuntimeOverrides,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": 0,
    },
  },
];
