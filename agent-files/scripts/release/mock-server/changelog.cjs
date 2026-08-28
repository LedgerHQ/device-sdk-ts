#!/usr/bin/env zx

require("zx/globals");
const {
  CHANGELOG_PATH,
  PKG_NAME,
  enrich,
  fail,
  pendingChangesets,
  readPackage,
} = require("./common.cjs");

const SECTION_TITLES = {
  major: "Major Changes",
  minor: "Minor Changes",
  patch: "Patch Changes",
};

function formatEntry(entry, repo) {
  const short = entry.commit.slice(0, 7);
  const pr = `[#${entry.prNumber}](https://github.com/${repo}/pull/${entry.prNumber})`;
  const commitLink = `[\`${short}\`](https://github.com/${repo}/commit/${entry.commit})`;
  const thanks = `Thanks [@${entry.author}](https://github.com/${entry.author})!`;

  return `- ${pr} ${commitLink} ${thanks} - ${entry.summary}`;
}

function prepend(existing, section) {
  if (!existing) return `# ${PKG_NAME}\n${section}`;

  const firstNewline = existing.indexOf("\n");
  if (firstNewline === -1) return existing + section;

  return (
    existing.slice(0, firstNewline) +
    "\n" +
    section +
    existing.slice(firstNewline + 1)
  );
}

async function main() {
  const pkg = await readPackage();
  const changesets = await pendingChangesets();

  if (changesets.length === 0) {
    console.log(
      chalk.yellow(
        `No changeset for ${PKG_NAME}. Nothing to add to the changelog — ` +
          `describe the release in the PR body instead.`,
      ),
    );
    process.exit(0);
  }

  let existing = "";
  try {
    existing = await fs.readFile(CHANGELOG_PATH, "utf-8");
  } catch {
    // first release, no changelog yet
  }

  if (existing.includes(`\n## ${pkg.version}\n`)) {
    throw new Error(
      `CHANGELOG.md already has a "## ${pkg.version}" section. ` +
        `Did bump.cjs run before this script?`,
    );
  }

  console.log(chalk.blue("Enriching changesets with PR/commit metadata..."));
  const { repo } = await enrich(changesets);

  const byBump = { major: [], minor: [], patch: [] };
  for (const cs of changesets) byBump[cs.bump].push(cs);

  let section = `\n## ${pkg.version}\n`;
  for (const bump of ["major", "minor", "patch"]) {
    if (byBump[bump].length === 0) continue;
    section += `\n### ${SECTION_TITLES[bump]}\n\n`;
    section += byBump[bump]
      .map((cs) => formatEntry(cs, repo) + "\n")
      .join("\n");
  }

  await fs.writeFile(CHANGELOG_PATH, prepend(existing, section));

  console.log(
    chalk.green(
      `Updated ${path.relative(process.cwd(), CHANGELOG_PATH)} for ${pkg.version}`,
    ),
  );
}

main().catch(fail);
