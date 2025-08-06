import baseConfig from "@ledgerhq/eslint-config-dsdk";

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "no-restricted-syntax": 0,
      "@typescript-eslint/no-explicit-any": 1,
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
    files: ["**/*.tsx"],
    rules: {
      "react/prop-types": 1,
      "@typescript-eslint/no-require-imports": 1,
    },
  },
  {
    ignores: [
      "babel.config.js",
      "jest.config.js",
      "metro.config.js",
      "react-native.config.js",
    ],
  },
];
