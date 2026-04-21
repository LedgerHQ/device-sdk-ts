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

  const requested = resolvePackageNames(raw.split(",").map((s) => s.trim()));

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

  // --- selected: what this run will actually release ---
  const releaseSet = new Set(requested);
  const sourceMap = new Map(requested.map((n) => [n, "requested"]));

  // Major-dep auto-include (mirror set-private.cjs)
  const majors = new Set();
  for (const cs of changesets) {
    for (const [pkgName, bump] of Object.entries(cs.packages)) {
      if (bump === "major" && releaseSet.has(pkgName)) majors.add(pkgName);
    }
  }
  if (majors.size > 0) {
    for (const pkg of pkgs) {
      if (releaseSet.has(pkg.name)) continue;
      const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
      if ([...majors].some((m) => m in allDeps)) {
        releaseSet.add(pkg.name);
        sourceMap.set(pkg.name, "auto");
      }
    }
  }

  // Highest bump per released package from changesets
  const selectedBump = new Map();
  for (const cs of changesets) {
    for (const [pkgName, bump] of Object.entries(cs.packages)) {
      if (!releaseSet.has(pkgName)) continue;
      const cur = selectedBump.get(pkgName);
      if (!cur || BUMP_ORDER[bump] > BUMP_ORDER[cur]) {
        selectedBump.set(pkgName, bump);
      }
    }
  }
  // Auto-included packages get a synthetic patch
  for (const name of releaseSet) {
    if (sourceMap.get(name) === "auto" && !selectedBump.has(name)) {
      selectedBump.set(name, "patch");
    }
  }

  // Patch propagation (mirror bump.cjs)
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of releaseSet) {
      if (selectedBump.has(name)) continue;
      const pkg = pkgByName[name];
      if (!pkg) continue;
      const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
      for (const depName of Object.keys(allDeps)) {
        if (selectedBump.has(depName)) {
          selectedBump.set(name, "patch");
          changed = true;
          break;
        }
      }
    }
  }

  const missing = requested.filter((n) => !selectedBump.has(n));

  const rows = [...releaseSet]
    .filter((name) => pkgByName[name])
    .map((name) => {
      const bump = selectedBump.get(name) || "none";
      const from = pkgByName[name].version;
      const to = bump === "none" ? null : semver.inc(from, bump);
      return {
        name,
        displayName: DISPLAY_NAMES[name] || name,
        from,
        to,
        bump,
        source: sourceMap.get(name) || "auto",
        changesets: csMap[name] || [],
      };
    });

  const selected = { rows, missing };

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

  const result = { releasable, selected, warnings };
  console.log(JSON.stringify(result, null, 2));
}

main();
