#!/usr/bin/env zx
import path from "node:path";

const root = path.join(__dirname, "..");
const tsconfigEsm = path.join(root, "tsconfig.esm.json");
const tsconfigCjs = path.join(root, "tsconfig.cjs.json");

const buildEsm = async () => {
  await $`tsc --project ${tsconfigEsm} --incremental`;
  await $`tsc-alias --project ${tsconfigEsm}`;
};

const builCjs = async () => {
  await $`tsc --project ${tsconfigCjs} --incremental`;
  await $`tsc-alias --project ${tsconfigCjs}`;
};

const run = async () => await Promise.all([buildEsm(), builCjs()]);

run().catch((e) => {
  console.error(e);
});