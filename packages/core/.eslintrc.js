module.exports = {
  root: true,
  extends: ["@ledgerhq/dsdk"],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ["**/*.test.ts"],
      rules: {
        "no-restricted-imports": 0,
        "@typescript-eslint/unbound-method": 0,
      },
    },
  ],
};
