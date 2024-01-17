module.exports = {
  extends: ["next/core-web-vitals", "@ledgerhq/dsdk"],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
};
