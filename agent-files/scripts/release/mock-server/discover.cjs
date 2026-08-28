#!/usr/bin/env zx

require("zx/globals");
const {
  DISPLAY_NAME,
  IMAGE_REPO,
  PKG_NAME,
  fail,
  nextVersion,
  pendingChangesets,
  readPackage,
  resolveBump,
} = require("./common.cjs");

async function main() {
  const changesets = await pendingChangesets();
  const pkg = await readPackage();

  let bump;
  let source;
  try {
    ({ bump, source } = resolveBump(changesets, argv.bump));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          package: PKG_NAME,
          displayName: DISPLAY_NAME,
          version: pkg.version,
          changesets,
          error: err.message,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const to = nextVersion(pkg.version, bump);
  const mixed = changesets.filter((cs) => cs.otherPackages.length > 0);

  console.log(
    JSON.stringify(
      {
        package: PKG_NAME,
        displayName: DISPLAY_NAME,
        from: pkg.version,
        to,
        bump,
        bumpSource: source,
        changesets,
        mixedChangesets: mixed.map((cs) => cs.file),
        image: `${IMAGE_REPO}:${to}`,
      },
      null,
      2,
    ),
  );
}

main().catch(fail);
