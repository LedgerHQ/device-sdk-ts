import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["eslint.config.mjs", "vitest.*.mjs", "scripts/*.mjs", "lib"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
];
