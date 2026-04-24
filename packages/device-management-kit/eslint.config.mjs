import config from "@ledgerhq/eslint-config-dsdk";

export default [
  ...config,
  {
    ignores: ["eslint.config.mjs", "vitest.*.mjs", "scripts/*.mjs", "lib/**"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/*.test.ts",
      "src/api/command/**/*.ts",
      "src/api/index.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@api/command/model/CommandResult",
              importNames: ["CommandResultFactory"],
              message: "Use DmkResultFactory outside the command layer.",
            },
            {
              name: "@api/index",
              importNames: ["CommandResultFactory"],
              message: "Use DmkResultFactory outside the command layer.",
            },
            {
              name: "@ledgerhq/device-management-kit",
              importNames: ["CommandResultFactory"],
              message: "Use DmkResultFactory outside the command layer.",
            },
          ],
        },
      ],
    },
  },
];
