import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["eslint.config.mjs", "scripts/*.mjs"],
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