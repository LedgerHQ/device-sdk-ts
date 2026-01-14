import config from "@ledgerhq/eslint-config-dsdk";
import * as globals from "zx/globals";

export default [
  ...config,
  {
    files: ["**/*.cjs"],
    globals: {
      ...globals,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-require-imports": 0,
    },
  },
];
