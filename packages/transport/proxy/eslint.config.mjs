import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["eslint.config.mjs", "vitest.config.mjs", "lib/*"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: {
      "import/core-modules": ["ws"],
    },
    rules: {
      "import/no-unresolved": ["error", { ignore: ["^ws$"] }],
    },
  },
];
