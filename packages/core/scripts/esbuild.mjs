#!/usr/bin/env zx

import "zx/globals";
import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import path from "node:path";
const root = path.join(__dirname, "..");
const tsconfig = path.join(root, "tsconfig.prod.json");

const config = {
  entryPoints: ["index.ts"],
  // minify: true,
  bundle: true,
  treeShaking: true,
  sourcemap: true,
  color: true,
  // To analyze the bundle
  // https://esbuild.github.io/api/#build-metadata
  // metafile: true,
};

const buildBrowser = async () =>
  esbuild.build({
    ...config,
    outdir: "lib/esm",
    format: "esm",
    platform: "browser",
  });

const buildNode = async () =>
  esbuild.build({
    ...config,
    outdir: "lib/cjs",
    format: "cjs",
    platform: "node",
    plugins: [nodeExternalsPlugin()],
  });

const buildTypes = async () => {
  await $`tsc --project ${tsconfig} --incremental`;
  await $`tsc-alias --project ${tsconfig}`;
};

const build = async () =>
  Promise.all([buildBrowser(), buildNode(), buildTypes()]);

build().catch((e) => {
  console.error(e);
  process.exitCode = e.exitCode;
});
