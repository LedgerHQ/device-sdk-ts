#!/usr/bin/env zx

import "zx/globals";
import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import { replaceTscAliasPaths } from "tsc-alias";

const config = {
  minify: true,
  bundle: false,
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
    plugins: [
      {
        name: "tsc-alias",
        setup(build) {
          build.onEnd(async () => {
            await $`cp package.json lib/esm/package.json`;

            await replaceTscAliasPaths({
              configFile: tsconfig,
              outDir: "lib/esm",
              watch: false,
            });
          });
        },
      },
    ],
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
    plugins: [
      nodeExternalsPlugin(),
      {
        name: "tsc-alias",
        setup(build) {
          build.onEnd(async () => {
            await $`cp package.json lib/cjs/package.json`;

            await replaceTscAliasPaths({
              configFile: tsconfig,
              outDir: "lib/cjs",
              watch: false,
            });
          });
        },
      },
    ],
  });
};

const buildTypes = async () => {
  console.log(chalk.blue("Building types..."));
  await $`tsc --project ${tsconfig} --incremental`;
  await $`tsc-alias --project ${tsconfig}`;
};

const build = async () =>
  process.env.CI
    ? Promise.all([buildBrowser(), buildNode(), buildTypes()])
    : spinner(() => Promise.all([buildBrowser(), buildNode(), buildTypes()]));

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
