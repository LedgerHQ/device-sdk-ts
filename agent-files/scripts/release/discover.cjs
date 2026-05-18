#!/usr/bin/env zx

require("zx/globals");
const semver = require("semver");
const {
  DISPLAY_NAMES,
  getWorkspacePackages,
  readChangesets,
  resolvePackageNames,
} = require("./config.cjs");

const BUMP_ORDER = { major: 3, minor: 2, patch: 1 };

function highestBump(a, b) {
  return (BUMP_ORDER[a] || 0) >= (BUMP_ORDER[b] || 0) ? a : b;
}

async function main() {
  const raw = argv.packages;
  if (!raw) {
    console.error(chalk.red("Usage: discover.cjs --packages dmk,signer-eth"));
    process.exit(1);
  }

  const requested = new Set(
    resolvePackageNames(raw.split(",").map((s) => s.trim())),
  );

  const pkgs = await getWorkspacePackages();
  const changesets = await readChangesets();
  const workspaceNames = new Set(pkgs.map((p) => p.name));
  const pkgByName = Object.fromEntries(pkgs.map((p) => [p.name, p]));

  // Aggregate bumps and changesets per package
  const bumpMap = {};
  const csMap = {};
  for (const cs of changesets) {
    for (const [name, bump] of Object.entries(cs.packages)) {
      bumpMap[name] = highestBump(bumpMap[name] || "patch", bump);
      (csMap[name] ||= []).push(cs.file.replace(/\.md$/, ""));
    }
  }

  const releasable = Object.keys(bumpMap)
    .filter((n) => pkgByName[n])
    .map((name) => ({
      name,
      displayName: DISPLAY_NAMES[name] || name,
      version: pkgByName[name].version,
      bump: bumpMap[name],
      changesets: csMap[name],
    }));

  const selectedNames = new Set(
    releasable.map((r) => r.name).filter((n) => requested.has(n)),
  );

  const selected = releasable
    .filter((r) => selectedNames.has(r.name))
    .map((r) => {
      const pkg = pkgByName[r.name];
      const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
      const depsNotReleased = Object.keys(allDeps)
        .filter((d) => workspaceNames.has(d) && !selectedNames.has(d))
        .map((d) => ({
          name: d,
          displayName: DISPLAY_NAMES[d] || d,
          type: d in (pkg.dependencies || {}) ? "dependency" : "peerDependency",
        }));
      return {
        name: r.name,
        displayName: r.displayName,
        from: r.version,
        to: semver.inc(r.version, r.bump),
        bump: r.bump,
        changesets: r.changesets,
        depsNotReleased,
      };
    });

  console.log(JSON.stringify({ releasable, selected }, null, 2));
}

main();
