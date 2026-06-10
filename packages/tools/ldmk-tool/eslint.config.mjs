import config, { nodeRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";
import * as globals from "zx/globals";

export default [
  ...config,
  ...nodeRuntimeOverrides,
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
