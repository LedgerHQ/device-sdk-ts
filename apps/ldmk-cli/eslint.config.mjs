import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["**/*.test.ts"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    files: ["eslint.config.mjs", "vitest.config.mjs"],
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
