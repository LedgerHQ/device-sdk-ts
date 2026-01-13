import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["eslint.config.mjs", "lib", "scripts/*.mjs"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
];
