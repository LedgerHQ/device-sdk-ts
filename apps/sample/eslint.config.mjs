import baseConfig, { webRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";
import globals from "globals";

export default [
  ...baseConfig,
  ...webRuntimeOverrides,
  {
    ignores: [".next"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
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
    files: ["playwright.config.ts"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-imports": "off",
    },
  },
  {
    files: [
      "src/app/page.tsx",
      "src/app/global-error.tsx",
      "src/app/client-layout.tsx",
      "src/app/**/page.tsx",
    ],
    rules: {
      "no-restricted-syntax": 0,
    },
  },
  {
    files: ["next.config.js", "postcss.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
];
