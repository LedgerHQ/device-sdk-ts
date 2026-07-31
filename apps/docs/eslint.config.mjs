import baseConfig from "@ledgerhq/eslint-config-dsdk";
import globals from "globals";

export default [
  ...baseConfig,
  {
    ignores: [".next", "public/_pagefind", "**/_meta.js"],
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
    files: ["next.config.mjs", "postcss.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    // Next.js App Router entrypoints require default exports and import the
    // global stylesheet via a relative path.
    files: ["app/**/*.{js,jsx,ts,tsx}", "mdx-components.js"],
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
    },
  },
];
