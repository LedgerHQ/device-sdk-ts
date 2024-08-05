#!/usr/bin/env zx
import path from "node:path";

const root = path.join(__dirname, "..");
const tsconfigEsm = path.join(root, "tsconfig.esm.json");
const tsconfigCjs = path.join(root, "tsconfig.cjs.json");

const buildEsm = async () => {
  await $`tsc --project ${tsconfigEsm} --incremental`;
};

const builCjs = async () => {
  await $`tsc --project ${tsconfigCjs} --incremental`;
};

const run = async () => await Promise.all([buildEsm(), builCjs()]);

run().catch((e) => {
  console.error(e);
  process.exit(e.errorCode)
});
