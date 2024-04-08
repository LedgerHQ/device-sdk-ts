#!/usr/bin/env zx
import { build } from "esbuild";
import { /* alias, */ buildConfig } from "@ledgerhq/esbuild-tools";
import dtsPlugin from "esbuild-plugin-d.ts";
import pkg from "../package.json" assert { type: "json" };

const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const outdir = path.join(root, "lib");
const tsconfigEsm = path.join(root, "tsconfig.esm.json");
const tsconfigCjs = path.join(root, "tsconfig.cjs.json");

const conf = {
  entryPoints: [path.join(srcRoot, "index.ts")],
  plugins: [
    // EXAMPLE USAGE, UNCOMMENT TO USE
    // alias({
    //   "@root": root,
    //   "@internal": path.join(srcRoot, "internal"),
    //   "@api": path.join(srcRoot, "api"),
    // }),
  ],
};

const common = buildConfig(conf, pkg);

const buildEsm = async () => {
  const config = {
    ...common,
    outdir: path.join(outdir, "esm"),
    format: "esm",
    tsconfig: tsconfigEsm,
    plugins: [
      ...common.plugins,
      dtsPlugin({
        tsconfig: tsconfigEsm,
      }),
    ],
  };

  await build(config);
};

const builCjs = async () => {
  const config = {
    ...common,
    outdir: path.join(outdir, "cjs"),
    format: "cjs",
    tsconfig: tsconfigCjs,
    plugins: [
      ...common.plugins,
      dtsPlugin({
        tsconfig: tsconfigCjs,
      }),
    ],
  };

  await build(config);
};

const run = async () => Promise.all([buildEsm(), builCjs()]);

run()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
  });
