#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages } = require("./config.cjs");

async function main() {
  const pkgs = await getWorkspacePackages();
  const pkgNames = new Set(pkgs.map((p) => p.name));
  const restored = [];

  for (const pkg of pkgs) {
    const json = await fs.readJson(pkg.path);
    let changed = false;

    for (const depField of ["dependencies", "peerDependencies"]) {
      const deps = json[depField];
      if (!deps) continue;

      for (const [depName, depValue] of Object.entries(deps)) {
        if (!pkgNames.has(depName)) continue;
        if (depValue === "workspace:^") continue;
        if (depValue.startsWith("workspace:")) continue;

        deps[depName] = "workspace:^";
        changed = true;
        restored.push({
          package: pkg.name,
          dep: depName,
          field: depField,
          from: depValue,
        });
      }
    }

    if (changed) {
      await fs.writeJson(pkg.path, json, { spaces: 2 });
    }
  }

  if (restored.length === 0) {
    console.log(chalk.green("All internal deps already use workspace:^."));
  } else {
    console.log(
      chalk.green(`Restored ${restored.length} dep(s) to workspace:^.`),
    );
  }

  console.log(JSON.stringify({ restored }, null, 2));
}

main();
