#!/usr/bin/env zx

import esbuild from "esbuild";

const config = {
  entryPoints: ["src/index.ts"],
  // minify: true,
  bundle: true,
  treeShaking: true,
  sourcemap: true,
  color: true,
  // To analyze the bundle
  // https://esbuild.github.io/api/#build-metadata
  // metafile: true,
};

const getBrowserContext = async () =>
  esbuild.context({
    ...config,
    outdir: "lib/esm",
    format: "esm",
    platform: "browser",
  });

const getNodeContext = async () =>
  esbuild.context({
    ...config,
    outdir: "lib/cjs",
    format: "cjs",
    platform: "node",
  });

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
