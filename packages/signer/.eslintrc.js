module.exports = {
  root: true,
  extends: ["@ledgerhq/dsdk"],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
};
