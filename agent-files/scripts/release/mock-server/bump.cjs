#!/usr/bin/env zx

require("zx/globals");
const {
  IMAGE_REPO,
  PKG_NAME,
  PKG_PATH,
  fail,
  nextVersion,
  pendingChangesets,
  readPackage,
  resolveBump,
} = require("./common.cjs");

async function main() {
  const changesets = await pendingChangesets();
  const pkg = await readPackage();
  const { bump, source } = resolveBump(changesets, argv.bump);

  const from = pkg.version;
  const to = nextVersion(from, bump);

  pkg.version = to;
  await fs.writeJson(PKG_PATH, pkg, { spaces: 2 });

  console.log(chalk.green(`${PKG_NAME}: ${from} → ${to} [${bump}]`));
  console.log(
    JSON.stringify(
      {
        package: PKG_NAME,
        from,
        to,
        bump,
        bumpSource: source,
        image: `${IMAGE_REPO}:${to}`,
      },
      null,
      2,
    ),
  );
}

main().catch(fail);
