import baseConfig, { webRuntimeOverrides } from "@ledgerhq/eslint-config-dsdk";

export default [
  ...baseConfig,
  ...webRuntimeOverrides,
  {
    ignores: ["dist"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
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
    // Vite compiles JSX with the automatic runtime, so React needs no import.
    files: ["**/*.tsx"],
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    // Build-time config, run by Node: a default export and node: imports are
    // exactly what Vite and Tailwind expect here.
    files: ["vite.config.ts", "tailwind.config.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
    },
  },
];
