module.exports = {
  extends: ["next/core-web-vitals", "@ledgerhq/dsdk"],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
};
