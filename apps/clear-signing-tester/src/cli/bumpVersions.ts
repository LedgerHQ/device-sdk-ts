#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

import {
  bumpAppVersions,
  type CatalogueDevices,
  type VersionTree,
} from "./bumpAppVersions";

/** Coin apps of each nightly family, as named in `default_versions.json`. */
const FAMILIES: Record<string, string[]> = {
  ethereum: ["Ethereum"],
  solana: ["Solana"],
  tron: ["Tron"],
  "btc-legacy": [
    "Litecoin",
    "Dogecoin",
    "Bitcoin Cash",
    "Bitcoin Gold",
    "Horizen",
    "Komodo",
  ],
};

const VERSIONS_FILE = "default_versions.json";

/**
 * Bumps one family's apps in `default_versions.json` to the newest stable
 * versions on Speculinho, and prints the changes as a Markdown table.
 *
 * Usage: `pnpm bump-versions <family>`
 */
async function main() {
  const family = process.argv[2] ?? "";
  const apps = FAMILIES[family];
  if (!apps) {
    throw new Error(
      `Unknown family "${family}", expected one of: ${Object.keys(FAMILIES).join(", ")}.`,
    );
  }

  const url = `${process.env["SPECULINHO_URL"] ?? "https://speculinho.ledgerlabs.net"}/catalogue`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}.`);
  }
  const { devices } = (await response.json()) as { devices: CatalogueDevices };

  const current = JSON.parse(
    readFileSync(VERSIONS_FILE, "utf8"),
  ) as VersionTree;
  const { pins, bumps } = bumpAppVersions(current, devices, apps);
  if (bumps.length === 0) return;

  writeFileSync(VERSIONS_FILE, `${JSON.stringify(pins, null, 2)}\n`);
  console.log("| Device | App | Version | OS |");
  console.log("| --- | --- | --- | --- |");
  for (const bump of bumps) {
    const os =
      bump.fromOs === bump.toOs ? bump.toOs : `${bump.fromOs} → ${bump.toOs}`;
    console.log(
      `| ${bump.device} | ${bump.app} | ${bump.fromVersion} → ${bump.toVersion} | ${os} |`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
