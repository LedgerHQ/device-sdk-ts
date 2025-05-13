#!/usr/bin/env zx

require("zx/globals");
const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const { replaceTscAliasPaths } = require("tsc-alias");

const config = {
  entryPoints: ["index.ts"],
  minify: false,
  bundle: false,
  treeShaking: true,
  sourcemap: true,
  color: true,
  // To analyze the bundle
  // https://esbuild.github.io/api/#build-metadata
  // metafile: true,
};

const getBrowserContext = async (entryPoints, tsconfig) => {
  console.log(chalk.blue("Watching browser bundle..."));

  await replaceTscAliasPaths({
    configFile: tsconfig,
    outDir: "lib/esm",
    watch: true,
  });

  return esbuild.context({
    ...config,
    entryPoints,
    outdir: "lib/esm",
    format: "esm",
    platform: "browser",
    plugins: [
      {
        name: "copy-package-json",
        setup(build) {
          build.onEnd(async () => {
            await $`cp package.json lib/esm/package.json`;
          });
        },
      },
    ],
  });
};

const getNodeContext = async (entryPoints, tsconfig) => {
  console.log(chalk.blue("Watching node bundle..."));

  await replaceTscAliasPaths({
    configFile: tsconfig,
    outDir: "lib/cjs",
    watch: true,
  });

  return esbuild.context({
    ...config,
    entryPoints,
    outdir: "lib/cjs",
    format: "cjs",
    platform: "node",
    plugins: [
      nodeExternalsPlugin(),
      {
        name: "copy-package-json",
        setup(build) {
          build.onEnd(async () => {
            await $`cp package.json lib/cjs/package.json`;
          });
        },
      },
    ],
  });
};

const watch = async (entryPoints, tsconfig, platform) => {
  const entryPointsArray = entryPoints.includes(",")
    ? entryPoints.split(",")
    : [entryPoints];

  const browserContext = await getBrowserContext(entryPointsArray, tsconfig);
  const nodeContext = await getNodeContext(entryPointsArray, tsconfig);
  if (platform === "web") {
    await browserContext.watch();
  } else if (platform === "node") {
    await nodeContext.watch();
  } else {
    await browserContext.watch();
    await nodeContext.watch();
  }
};

module.exports = {
  watch,
};
