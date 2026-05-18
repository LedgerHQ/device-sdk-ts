#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages, readChangesets, ROOT } = require("./config.cjs");

async function main() {
  const pkgs = await getWorkspacePackages();
  const releaseNames = new Set(
    pkgs.filter((p) => !p.private).map((p) => p.name),
  );

  const changesets = await readChangesets();
  const changesetDir = path.join(ROOT, ".changeset");
  const deleted = [];

  for (const cs of changesets) {
    const affectsRelease = Object.keys(cs.packages).some((pkg) =>
      releaseNames.has(pkg),
    );
    if (!affectsRelease) continue;

    const filePath = path.join(changesetDir, cs.file);
    await fs.remove(filePath);
    deleted.push(cs.file);
    console.log(chalk.gray(`Deleted .changeset/${cs.file}`));
  }

  if (deleted.length === 0) {
    console.log(chalk.yellow("No changeset files to clean up."));
  } else {
    console.log(chalk.green(`Removed ${deleted.length} changeset file(s).`));
  }

  console.log(JSON.stringify({ deleted }, null, 2));
}

main();
