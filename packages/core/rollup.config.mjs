import typescript from "@rollup/plugin-typescript";
import commonJs from "@rollup/plugin-commonjs";

export default {
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
  plugins: [commonJs(), typescript({ tsconfig: "./tsconfig.prod.json" })],
};
