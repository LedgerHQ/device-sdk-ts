import baseConfig from "@ledgerhq/eslint-config-dsdk";
import globals from "globals";

export default [
  ...baseConfig,
  {
    ignores: [".next", "**/_meta.js"],
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
    files: [
      "next.config.mjs",
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
