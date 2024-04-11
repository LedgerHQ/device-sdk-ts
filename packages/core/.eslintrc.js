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
        "@typescript-eslint/unbound-method": 0,
      },
    },
    {
      files: ["**/*.mjs"],
      env: {
        es6: true,
        node: true,
      },
      globals: {
        log: true,
        $: true,
        argv: true,
        cd: true,
        chalk: true,
        echo: true,
        expBackoff: true,
        fs: true,
        glob: true,
        globby: true,
        nothrow: true,
        os: true,
        path: true,
        question: true,
        quiet: true,
        quote: true,
        quotePowerShell: true,
        retry: true,
        sleep: true,
        spinner: true,
        ssh: true,
        stdin: true,
        which: true,
        within: true,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  ],
};
