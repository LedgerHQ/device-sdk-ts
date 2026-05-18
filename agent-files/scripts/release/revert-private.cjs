#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages } = require("./config.cjs");

async function main() {
  const pkgs = await getWorkspacePackages();
  const changed = [];

  for (const pkg of pkgs) {
    const json = await fs.readJson(pkg.path);
    if (json.private === true) {
      json.private = false;
      await fs.writeJson(pkg.path, json, { spaces: 2 });
      changed.push(pkg.name);
    }
  }

  if (changed.length === 0) {
    console.log(chalk.green("All packages already have private:false."));
  } else {
    console.log(
      chalk.green(`Set private:false on ${changed.length} package(s):`),
    );
    for (const name of changed) console.log(chalk.cyan(`  ${name}`));
  }

  console.log(JSON.stringify({ reverted: changed }, null, 2));
}

main();
