#!/usr/bin/env zx

import "zx/globals";
import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

const config = {
  minify: false,
  bundle: true,
  treeShaking: true,
  sourcemap: true,
  color: true,
  // To analyze the bundle
  // https://esbuild.github.io/api/#build-metadata
  // metafile: true,
};

const { entryPoints, tsconfig } = argv;

if (!entryPoints) {
  console.error(chalk.red("Entry points are required"));
  process.exit(1);
}

if (!tsconfig) {
  console.error(chalk.red("TSConfig file is required"));
  process.exit(1);
}
const entryPointsArray = entryPoints.includes(",")
  ? entryPoints.split(",")
  : [entryPoints];

const buildBrowser = async () => {
  console.log(chalk.blue("Building browser bundle..."));
  return esbuild.build({
    ...config,
    entryPoints: entryPointsArray,
    outdir: "lib/esm",
    format: "esm",
    platform: "browser",
  });
};

const buildNode = async () => {
  console.log(chalk.blue("Building node bundle..."));
  return esbuild.build({
    ...config,
    entryPoints: entryPointsArray,
    outdir: "lib/cjs",
    format: "cjs",
    platform: "node",
    plugins: [nodeExternalsPlugin()],
  });
};

const buildTypes = async () => {
  console.log(chalk.blue("Building types..."));
  await $`tsc --project ${tsconfig} --incremental`;
  await $`tsc-alias --project ${tsconfig}`;
};

const build = async () =>
  spinner(() => Promise.all([buildBrowser(), buildNode(), buildTypes()]));

build()
  .then(() => {
    console.log(chalk.green("Build succeeded"));
    process.exitCode = 0;
  })
  .catch((e) => {
    console.error(chalk.red("Build failed"));
    console.error(e);
    process.exitCode = e.exitCode;
  });
