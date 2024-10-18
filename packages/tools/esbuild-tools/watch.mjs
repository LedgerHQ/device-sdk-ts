#!/usr/bin/env zx

import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import { replaceTscAliasPaths } from "tsc-alias";

const config = {
  entryPoints: ["index.ts"],
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

const getBrowserContext = async () => {
  console.log(chalk.blue("Watching browser bundle..."));
  return esbuild.context({
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

const getNodeContext = async () => {
  console.log(chalk.blue("Watching node bundle..."));
  return esbuild.context({
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

const watch = async () => {
  const browserContext = await getBrowserContext();
  const nodeContext = await getNodeContext();
  await browserContext.watch();
  await nodeContext.watch();
};

watch().catch((e) => {
  console.error(e);
  process.exitCode = e.exitCode;
});
