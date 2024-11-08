import baseConfig from "@ledgerhq/eslint-config-dsdk";
import globals from "globals";

export default [
  ...baseConfig,
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
    files: [
      "next.config.js",
      "postcss.config.js",
      "tailwind.config.js",
      "theme.config.tsx",
    ],
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
