const tsPlugin = require("@rollup/plugin-typescript");
const alias = require("@rollup/plugin-alias");
const path = require("node:path");

console.log("yolo world");
module.exports = {
  input: "src/index.ts",
  output: {
    dir: "lib",
    format: "esm",
    sourcemap: true,
    // https://rollupjs.org/guide/en/#outputpreservemodulesroot
    // Used here to keep the same folder structure and it's file.
    // Without it, we just generated 1 js file with all the code, `lib/index.js`
    preserveModules: true,
    preserveModulesRoot: "src",
  },
  external: [
    "reflect-metadata",
    "inversify",
    "inversify-logger-middleware",
    "purify-ts",
  ],
  plugins: [
    alias({
      entries: [
        {
          find: "@internal",
          replacement: path.resolve(__dirname, "src/internal"),
        },
      ],
    }),
    tsPlugin({ tsconfig: "./tsconfig.prod.json" }),
  ],
};
