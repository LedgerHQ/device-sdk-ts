#!/usr/bin/env zx

require("zx/globals");
const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const { replaceTscAliasPaths } = require("tsc-alias");

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

const buildBrowser = async (entryPoints, tsconfig) => {
  console.log(chalk.blue("Building browser bundle..."));
  return esbuild.build({
    ...config,
    entryPoints,
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

const buildNode = async (entryPoints, tsconfig) => {
  console.log(chalk.blue("Building node bundle..."));
  return esbuild.build({
    ...config,
    entryPoints,
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

const buildTypes = async (tsconfig) => {
  console.log(chalk.blue("Building types..."));
  await $`tsc --project ${tsconfig} --incremental`;
  await $`tsc-alias --project ${tsconfig}`;
};

const build = async (entryPoints, tsconfig, platform) => {
  const entryPointsArray = entryPoints.includes(",")
    ? entryPoints.split(",")
    : [entryPoints];
  const p = [];
  if (platform === "web") {
    console.log(chalk.magenta("Target:", platform));
    p.push(buildBrowser(entryPointsArray, tsconfig));
    p.push(buildTypes(tsconfig));
  } else if (platform === "node") {
    console.log(chalk.magenta("Target:", platform));
    p.push(buildNode(entryPointsArray, tsconfig));
    p.push(buildTypes(tsconfig));
  } else {
    console.log(chalk.magenta("Building for both web and node"));
    p.push(buildBrowser(entryPointsArray, tsconfig));
    p.push(buildNode(entryPointsArray, tsconfig));
    p.push(buildTypes(tsconfig));
  }

  return process.env.CI ? Promise.all(p) : spinner(() => Promise.all(p));
};

module.exports = {
  build,
};
