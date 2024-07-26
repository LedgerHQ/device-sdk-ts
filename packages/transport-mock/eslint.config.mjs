import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
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
