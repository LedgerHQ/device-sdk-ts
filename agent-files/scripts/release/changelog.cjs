#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages, enrichChangesets } = require("./config.cjs");

const SECTION_TITLES = {
  major: "Major Changes",
  minor: "Minor Changes",
  patch: "Patch Changes",
};

function formatEntry(entry, repo) {
  const { summary, commit, prNumber, author } = entry;

  if (!prNumber || !commit || !author) {
    throw new Error(
      `Incomplete changelog entry: prNumber=${prNumber}, commit=${commit}, author=${author}. ` +
      `Ensure enrichChangesets() ran successfully with network access.`,
    );
  }

  const short = commit.slice(0, 7);
  const pr = `[#${prNumber}](https://github.com/${repo}/pull/${prNumber})`;
  const commitLink = `[\`${short}\`](https://github.com/${repo}/commit/${commit})`;
  const thanks = `Thanks [@${author}](https://github.com/${author})!`;

  return `- ${pr} ${commitLink} ${thanks} - ${summary}`;
}

function formatDepCommitLinks(commits, repo) {
  if (!commits || commits.length === 0) return "";
  const links = commits.map((sha) => {
    const short = sha.slice(0, 7);
    return `[\`${short}\`](https://github.com/${repo}/commit/${sha})`;
  });
  return ` [${links.join(", ")}]`;
}

async function main() {
  const pkgs = await getWorkspacePackages();
  const releasePkgs = pkgs.filter((p) => !p.private);
  const releaseNames = new Set(releasePkgs.map((p) => p.name));
  const pkgByName = Object.fromEntries(pkgs.map((p) => [p.name, p]));

  console.log(chalk.blue("Enriching changesets with PR/commit metadata..."));
  const { changesets, repo } = await enrichChangesets();

  if (changesets.length === 0) {
    console.log(chalk.yellow("No changesets found. Nothing to generate."));
    process.exit(0);
  }

  const entriesByPkg = new Map();

  for (const cs of changesets) {
    for (const [pkg, bump] of Object.entries(cs.packages)) {
      if (!releaseNames.has(pkg)) continue;
      if (!entriesByPkg.has(pkg)) entriesByPkg.set(pkg, []);
      entriesByPkg.get(pkg).push({
        bump,
        summary: cs.summary,
        commit: cs.commit,
        prNumber: cs.prNumber,
        author: cs.author,
      });
    }
  }

  // Collect commits per package (for "Updated dependencies" commit links)
  const commitsByPkg = new Map();
  for (const cs of changesets) {
    if (!cs.commit) continue;
    for (const pkg of Object.keys(cs.packages)) {
      if (!commitsByPkg.has(pkg)) commitsByPkg.set(pkg, new Set());
      commitsByPkg.get(pkg).add(cs.commit);
    }
  }

  const depUpdates = new Map();
  for (const pkg of releasePkgs) {
    const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
    const updates = [];
    for (const depName of Object.keys(allDeps)) {
      const dep = pkgByName[depName];
      if (dep && releaseNames.has(depName) && depName !== pkg.name) {
        updates.push(`${depName}@${dep.version}`);
      }
    }
    if (updates.length > 0) depUpdates.set(pkg.name, updates);
  }

  const updatedFiles = [];

  for (const pkg of releasePkgs) {
    const entries = entriesByPkg.get(pkg.name);
    const deps = depUpdates.get(pkg.name);
    if (!entries && !deps) continue;

    let section = `\n## ${pkg.version}\n`;

    if (entries) {
      const byBump = { major: [], minor: [], patch: [] };
      for (const e of entries) byBump[e.bump].push(e);

      for (const bump of ["major", "minor", "patch"]) {
        if (byBump[bump].length === 0) continue;
        section += `\n### ${SECTION_TITLES[bump]}\n\n`;
        section += byBump[bump]
          .map((e) => formatEntry(e, repo) + "\n")
          .join("\n");
      }
    }

    if (deps) {
      if (!entries || !entries.some((e) => e.bump === "patch")) {
        section += `\n### Patch Changes\n\n`;
      } else {
        section += "\n";
      }

      // Collect commits from changesets that touch the dependency packages
      const depCommits = new Set();
      for (const depPkgEntry of deps) {
        const depName = depPkgEntry.split("@").slice(0, -1).join("@");
        const pkgCommits = commitsByPkg.get(depName);
        if (pkgCommits) {
          for (const c of pkgCommits) depCommits.add(c);
        }
      }
      const commitLinks = formatDepCommitLinks([...depCommits], repo);

      section += `- Updated dependencies${commitLinks}:\n`;
      for (const dep of deps) {
        section += `  - ${dep}\n`;
      }
    }

    const changelogPath = path.join(pkg.dir, "CHANGELOG.md");
    let existing = "";
    try {
      existing = await fs.readFile(changelogPath, "utf-8");
    } catch {
      // no existing changelog
    }

    let newContent;
    if (existing) {
      const firstNewline = existing.indexOf("\n");
      if (firstNewline === -1) {
        newContent = existing + section;
      } else {
        newContent =
          existing.slice(0, firstNewline) +
          "\n" +
          section +
          existing.slice(firstNewline + 1);
      }
    } else {
      newContent = `# ${pkg.name}\n${section}`;
    }

    await fs.writeFile(changelogPath, newContent);
    updatedFiles.push(changelogPath);
    console.log(
      chalk.green(`Updated ${path.relative(process.cwd(), changelogPath)}`),
    );
  }

  if (updatedFiles.length === 0) {
    console.log(chalk.yellow("No CHANGELOG files needed updating."));
  }
}

main();
