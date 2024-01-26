import typescript from "@rollup/plugin-typescript";
import commonJs from "@rollup/plugin-commonjs";

export default {
  input: "src/index.ts",
  output: {
    dir: "lib",
    format: "esm",
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: "src",
  },
  plugins: [commonJs(), typescript({ tsconfig: "./tsconfig.json" })],
};
