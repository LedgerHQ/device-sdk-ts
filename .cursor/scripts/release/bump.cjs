#!/usr/bin/env zx

require("zx/globals");
const semver = require("semver");
const { getWorkspacePackages, readChangesets } = require("./config.cjs");

const BUMP_ORDER = { patch: 0, minor: 1, major: 2 };

async function main() {
  const pkgs = await getWorkspacePackages();
  const releasePkgs = pkgs.filter((p) => !p.private);
  const releaseNames = new Set(releasePkgs.map((p) => p.name));
  const pkgByName = Object.fromEntries(pkgs.map((p) => [p.name, p]));

  const changesets = await readChangesets();

  if (changesets.length === 0) {
    console.log(chalk.yellow("No changesets found. Nothing to bump."));
    process.exit(0);
  }

  // 1. Collect highest bump per package
  const bumpMap = new Map();

  for (const cs of changesets) {
    for (const [pkg, bump] of Object.entries(cs.packages)) {
      if (!releaseNames.has(pkg)) continue;
      const current = bumpMap.get(pkg);
      if (!current || BUMP_ORDER[bump] > BUMP_ORDER[current]) {
        bumpMap.set(pkg, bump);
      }
    }
  }

  // 2. Propagate patch bumps to released dependents
  const propagated = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkg of releasePkgs) {
      if (bumpMap.has(pkg.name)) continue;
      const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
      for (const depName of Object.keys(allDeps)) {
        if (bumpMap.has(depName)) {
          bumpMap.set(pkg.name, "patch");
          propagated.push({ name: pkg.name, reason: depName });
          changed = true;
          break;
        }
      }
    }
  }

  if (bumpMap.size === 0) {
    console.log(
      chalk.yellow(
        "No released packages affected by changesets. Nothing to bump.",
      ),
    );
    process.exit(0);
  }

  // 3. Compute new versions
  const bumps = [];

  for (const [name, bumpType] of bumpMap) {
    const pkg = pkgByName[name];
    if (!pkg) continue;
    const from = pkg.version;
    const to = semver.inc(from, bumpType);
    if (!to) {
      console.error(
        chalk.red(`Failed to compute ${bumpType} bump for ${name}@${from}`),
      );
      process.exit(1);
    }
    bumps.push({ name, from, to, type: bumpType, path: pkg.path });
  }

  // 4. Write new versions to package.json
  const newVersionMap = Object.fromEntries(bumps.map((b) => [b.name, b.to]));

  for (const bump of bumps) {
    const json = await fs.readJson(bump.path);
    json.version = bump.to;

    for (const depField of ["dependencies", "peerDependencies"]) {
      const deps = json[depField];
      if (!deps) continue;
      for (const [depName, depValue] of Object.entries(deps)) {
        if (!newVersionMap[depName]) continue;
        if (depValue.includes("workspace")) continue;
        deps[depName] = `^${newVersionMap[depName]}`;
      }
    }

    await fs.writeJson(bump.path, json, { spaces: 2 });
  }

  // 5. Print summary
  for (const b of bumps) {
    const marker = propagated.some((p) => p.name === b.name)
      ? " (propagated)"
      : "";
    console.log(
      chalk.green(`${b.name}: ${b.from} → ${b.to} [${b.type}]${marker}`),
    );
  }

  console.log(
    JSON.stringify(
      {
        bumps: bumps.map(({ name, from, to, type }) => ({
          name,
          from,
          to,
          type,
        })),
        propagated,
      },
      null,
      2,
    ),
  );
}

main();
