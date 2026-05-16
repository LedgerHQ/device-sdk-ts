#!/usr/bin/env zx

require("zx/globals");

const ALIASES = {
  dmk: "@ledgerhq/device-management-kit",
  "mockserver-client": "@ledgerhq/device-mockserver-client",
  "context-module": "@ledgerhq/context-module",
  "signer-btc": "@ledgerhq/device-signer-kit-bitcoin",
  "signer-eth": "@ledgerhq/device-signer-kit-ethereum",
  "signer-sol": "@ledgerhq/device-signer-kit-solana",
  "signer-aleo": "@ledgerhq/device-signer-kit-aleo",
  "signer-cosmos": "@ledgerhq/device-signer-kit-cosmos",
  "signer-hyperliquid": "@ledgerhq/device-signer-kit-hyperliquid",
  "signer-concordium": "@ledgerhq/device-signer-kit-concordium",
  "signer-polkadot": "@ledgerhq/device-signer-kit-polkadot",
  "signer-zcash": "@ledgerhq/device-signer-kit-zcash",
  "signer-utils": "@ledgerhq/signer-utils",
  "speculos-controller": "@ledgerhq/speculos-device-controller",
  "transport-mockserver": "@ledgerhq/device-transport-kit-mockserver",
  "transport-node-hid": "@ledgerhq/device-transport-kit-node-hid",
  "transport-rn-ble": "@ledgerhq/device-transport-kit-react-native-ble",
  "transport-rn-hid": "@ledgerhq/device-transport-kit-react-native-hid",
  "transport-speculos": "@ledgerhq/device-transport-kit-speculos",
  "transport-web-ble": "@ledgerhq/device-transport-kit-web-ble",
  "transport-web-hid": "@ledgerhq/device-transport-kit-web-hid",
  "keyring-protocol":
    "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol",
  "devtools-core": "@ledgerhq/device-management-kit-devtools-core",
  "devtools-rozenite": "@ledgerhq/device-management-kit-devtools-rozenite",
  "devtools-ui": "@ledgerhq/device-management-kit-devtools-ui",
  "devtools-ws-common":
    "@ledgerhq/device-management-kit-devtools-websocket-common",
  "devtools-ws-connector":
    "@ledgerhq/device-management-kit-devtools-websocket-connector",
  "devtools-ws-server":
    "@ledgerhq/device-management-kit-devtools-websocket-server",
  "ledger-wallet": "@ledgerhq/dmk-ledger-wallet",
};

const DISPLAY_NAMES = {
  "@ledgerhq/device-management-kit": "DMK",
  "@ledgerhq/device-mockserver-client": "Mockserver Client",
  "@ledgerhq/context-module": "Context Module",
  "@ledgerhq/device-signer-kit-bitcoin": "Signer BTC",
  "@ledgerhq/device-signer-kit-ethereum": "Signer ETH",
  "@ledgerhq/device-signer-kit-solana": "Signer SOL",
  "@ledgerhq/device-signer-kit-aleo": "Signer Aleo",
  "@ledgerhq/device-signer-kit-cosmos": "Signer Cosmos",
  "@ledgerhq/device-signer-kit-hyperliquid": "Signer Hyperliquid",
  "@ledgerhq/device-signer-kit-concordium": "Signer Concordium",
  "@ledgerhq/device-signer-kit-polkadot": "Signer Polkadot",
  "@ledgerhq/device-signer-kit-zcash": "Signer Zcash",
  "@ledgerhq/signer-utils": "Signer Utils",
  "@ledgerhq/speculos-device-controller": "Speculos Device Controller",
  "@ledgerhq/device-transport-kit-mockserver": "Transport Mockserver",
  "@ledgerhq/device-transport-kit-node-hid": "Transport Node HID",
  "@ledgerhq/device-transport-kit-react-native-ble": "Transport RN BLE",
  "@ledgerhq/device-transport-kit-react-native-hid": "Transport RN HID",
  "@ledgerhq/device-transport-kit-speculos": "Transport Speculos",
  "@ledgerhq/device-transport-kit-web-ble": "Transport Web BLE",
  "@ledgerhq/device-transport-kit-web-hid": "Transport Web HID",
  "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol":
    "Keyring Protocol",
  "@ledgerhq/device-management-kit-devtools-core": "DevTools Core",
  "@ledgerhq/device-management-kit-devtools-rozenite": "DevTools Rozenite",
  "@ledgerhq/device-management-kit-devtools-ui": "DevTools UI",
  "@ledgerhq/device-management-kit-devtools-websocket-common":
    "DevTools Websocket Common",
  "@ledgerhq/device-management-kit-devtools-websocket-connector":
    "DevTools Websocket Connector",
  "@ledgerhq/device-management-kit-devtools-websocket-server":
    "DevTools Websocket Server",
  "@ledgerhq/dmk-ledger-wallet": "Ledger Wallet",
};

const PUBLISH_GLOB = [
  "**/package.json",
  "!**/node_modules/**",
  "!package.json",
  "!**/lib/**",
  "!**/dist/**",
  "!**/apps/**",
  "!**/packages/config/**",
  "!**/packages/tools/**",
  "!**/packages/ui/**",
];

const ROOT = path.resolve(__dirname, "../../..");

async function getWorkspacePackages() {
  const files = await glob(PUBLISH_GLOB, { cwd: ROOT, absolute: true });
  const pkgs = [];

  for (const file of files) {
    const json = await fs.readJson(file);
    if (!json.name) continue;
    pkgs.push({
      name: json.name,
      version: json.version,
      private: json.private ?? false,
      path: file,
      dir: path.dirname(file),
      dependencies: json.dependencies ?? {},
      peerDependencies: json.peerDependencies ?? {},
    });
  }

  return pkgs;
}

function resolvePackageNames(aliases) {
  const fullNames = Object.values(ALIASES);
  return aliases.map((name) => {
    if (ALIASES[name]) return ALIASES[name];
    if (fullNames.includes(name)) return name;
    throw new Error(
      `Unknown package alias or name: "${name}". Use one of: ${Object.keys(ALIASES).join(", ")}`,
    );
  });
}

function parseChangeset(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const summary = match[2].trim();
  const packages = {};

  for (const line of frontmatter.split("\n")) {
    const m = line.match(/"([^"]+)":\s*(patch|minor|major)/);
    if (m) packages[m[1]] = m[2];
  }

  return { packages, summary };
}

async function readChangesets() {
  const changesetDir = path.join(ROOT, ".changeset");
  let files;
  try {
    files = await fs.readdir(changesetDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md") && f !== "README.md");
  const entries = [];

  for (const file of mdFiles) {
    const content = await fs.readFile(
      path.join(changesetDir, file),
      "utf-8",
    );
    const parsed = parseChangeset(content);
    if (parsed) entries.push({ file, ...parsed });
  }

  return entries;
}

async function enrichChangesets() {
  const changesets = await readChangesets();
  if (changesets.length === 0) return { changesets, repo: "" };

  const changesetConfigPath = path.join(ROOT, ".changeset", "config.json");
  let repo = "LedgerHQ/device-sdk-ts";
  try {
    const cfg = await fs.readJson(changesetConfigPath);
    if (Array.isArray(cfg.changelog) && cfg.changelog[1]?.repo) {
      repo = cfg.changelog[1].repo;
    }
  } catch {}

  const prevVerbose = $.verbose;
  $.verbose = false;

  for (const cs of changesets) {
    const filePath = path.join(ROOT, ".changeset", cs.file);
    try {
      const result = await $`git log --diff-filter=A --format=%H -1 -- ${filePath}`;
      cs.commit = result.stdout.trim() || null;
    } catch (err) {
      throw new Error(`Failed to resolve commit for changeset ${cs.file}: ${err.message}`);
    }
    if (!cs.commit) {
      throw new Error(`No commit found for changeset ${cs.file}. Was it committed to git?`);
    }
  }

  const commitMeta = new Map();
  const uniqueCommits = [
    ...new Set(changesets.map((cs) => cs.commit).filter(Boolean)),
  ];

  for (const sha of uniqueCommits) {
    const endpoint = `repos/${repo}/commits/${sha}/pulls`;
    const jq = ".[0] | {number, user: .user.login}";
    let result;
    try {
      result = await $`gh api ${endpoint} --jq ${jq}`;
    } catch (err) {
      throw new Error(`Failed to fetch PR metadata for commit ${sha}. Is gh authenticated?\n${err.message}`);
    }
    const data = JSON.parse(result.stdout.trim());
    if (!data.number || !data.user) {
      throw new Error(`Incomplete PR metadata for commit ${sha}: prNumber=${data.number}, author=${data.user}`);
    }
    commitMeta.set(sha, {
      prNumber: data.number,
      author: data.user,
    });
  }

  $.verbose = prevVerbose;

  for (const cs of changesets) {
    const meta = cs.commit ? commitMeta.get(cs.commit) : null;
    cs.prNumber = meta?.prNumber ?? null;
    cs.author = meta?.author ?? null;
  }

  return { changesets, repo };
}

module.exports = {
  ALIASES,
  DISPLAY_NAMES,
  PUBLISH_GLOB,
  ROOT,
  getWorkspacePackages,
  resolvePackageNames,
  parseChangeset,
  readChangesets,
  enrichChangesets,
};
