#!/usr/bin/env zx

require("zx/globals");
const {
  DISPLAY_NAMES,
  getWorkspacePackages,
  readChangesets,
} = require("./config.cjs");

const BUMP_ORDER = { major: 3, minor: 2, patch: 1 };

function highestBump(a, b) {
  return (BUMP_ORDER[a] || 0) >= (BUMP_ORDER[b] || 0) ? a : b;
}

async function main() {
  const pkgs = await getWorkspacePackages();
  const changesets = await readChangesets();

  const workspaceNames = new Set(pkgs.map((p) => p.name));
  const pkgByName = Object.fromEntries(pkgs.map((p) => [p.name, p]));

  // Build per-package bump level and changeset list
  const bumpMap = {};
  const csMap = {};
  for (const cs of changesets) {
    for (const [pkgName, bump] of Object.entries(cs.packages)) {
      bumpMap[pkgName] = highestBump(bumpMap[pkgName] || "patch", bump);
      csMap[pkgName] = csMap[pkgName] || [];
      csMap[pkgName].push(cs.file.replace(/\.md$/, ""));
    }
  }

  const releasableNames = new Set(Object.keys(bumpMap));

  const releasable = [...releasableNames]
    .filter((name) => pkgByName[name])
    .map((name) => ({
      name,
      displayName: DISPLAY_NAMES[name] || name,
      version: pkgByName[name].version,
      bump: bumpMap[name],
      changesets: csMap[name],
    }));

  // Detect internal deps of releasable packages that are NOT themselves releasable
  const warnings = [];
  for (const name of releasableNames) {
    const pkg = pkgByName[name];
    if (!pkg) continue;
    const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
    for (const depName of Object.keys(allDeps)) {
      if (workspaceNames.has(depName) && !releasableNames.has(depName)) {
        const depType =
          depName in (pkg.dependencies || {}) ? "dependency" : "peerDependency";
        const display = DISPLAY_NAMES[name] || name;
        const depDisplay = DISPLAY_NAMES[depName] || depName;
        warnings.push(
          `${display} (${name}) depends on ${depDisplay} (${depName}) as ${depType}, but ${depDisplay} has no changesets and will not be released.`,
        );
      }
    }
  }

  const result = { releasable, warnings };
  console.log(JSON.stringify(result, null, 2));
}

main();
