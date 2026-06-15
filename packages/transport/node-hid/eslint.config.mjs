import config, { nodeRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  ...nodeRuntimeOverrides,
  {
    ignores: ["eslint.config.mjs", "lib/*", "vitest.*.mjs"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
];
