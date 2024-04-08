const { overrides } = require("../../packages/config/eslint");

module.exports = {
  extends: ["next", "@ledgerhq/dsdk"],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  overrides: [
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
  ],
};
