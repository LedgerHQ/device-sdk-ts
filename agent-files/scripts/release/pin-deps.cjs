#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages, resolvePackageNames } = require("./config.cjs");

async function main() {
  const raw = argv.packages;
  if (!raw) {
    console.error(chalk.red("Usage: pin-deps.cjs --packages dmk,signer-eth"));
    process.exit(1);
  }

  const requested = resolvePackageNames(raw.split(",").map((s) => s.trim()));
  const releaseSet = new Set(requested);
  const pkgs = await getWorkspacePackages();
  const versionMap = Object.fromEntries(pkgs.map((p) => [p.name, p.version]));
  const pkgNames = new Set(pkgs.map((p) => p.name));

  const pinned = [];

  for (const pkg of pkgs) {
    if (!releaseSet.has(pkg.name)) continue;

    const json = await fs.readJson(pkg.path);
    let changed = false;

    for (const depField of ["dependencies", "peerDependencies"]) {
      const deps = json[depField];
      if (!deps) continue;

      for (const [depName, depValue] of Object.entries(deps)) {
        if (!pkgNames.has(depName)) continue;
        if (releaseSet.has(depName)) continue;
        if (!depValue.includes("workspace")) continue;

        const concreteVersion = versionMap[depName];
        if (!concreteVersion) continue;

        const newValue = `^${concreteVersion}`;
        deps[depName] = newValue;
        changed = true;
        pinned.push({
          package: pkg.name,
          dep: depName,
          field: depField,
          from: depValue,
          to: newValue,
        });
      }
    }

    if (changed) {
      await fs.writeJson(pkg.path, json, { spaces: 2 });
    }
  }

  if (pinned.length === 0) {
    console.log(chalk.green("No workspace deps needed pinning."));
  } else {
    console.log(
      chalk.green(`Pinned ${pinned.length} dependency reference(s).`),
    );
  }

  console.log(JSON.stringify({ pinned }, null, 2));
}

main();
