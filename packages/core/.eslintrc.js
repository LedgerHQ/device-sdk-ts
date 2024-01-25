module.exports = {
  root: true,
  extends: ["@ledgerhq/dsdk"],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: "src/**/*.test.ts",
      parserOptions: {
        project: "tsconfig.test.json",
        tsconfigRootDir: __dirname,
      },
    },
  ],
};
