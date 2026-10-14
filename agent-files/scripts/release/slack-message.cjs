#!/usr/bin/env zx

require("zx/globals");
const { getWorkspacePackages } = require("./config.cjs");

const ENTRY =
  /^- \[#(\d+)\]\([^)]*\) \[`\w+`\]\([^)]*\) Thanks \[@.+?\]\([^)]*\)! - (.*)$/;
const BUMPS = ["major", "minor", "patch"];

function parseLatestSection(changelog) {
  const sections = changelog.split(/^## /m).slice(1);
  const lines = sections[0].split("\n").slice(1);
  const entries = [];
  const deps = [];
  let bump;
  let inDeps = false;

  for (const line of lines) {
    const header = line.match(/^### (Major|Minor|Patch) Changes/);
    const entry = line.match(ENTRY);
    const dep = line.match(/^ {2}- (\S+@\S+)$/);

    if (header) {
      const level = header[1].toLowerCase();
      if (!bump || BUMPS.indexOf(level) < BUMPS.indexOf(bump)) bump = level;
      inDeps = false;
    } else if (entry) {
      entries.push({ pr: entry[1], summary: entry[2] });
      inDeps = false;
    } else if (line.startsWith("- Updated dependencies")) {
      inDeps = true;
    } else if (inDeps && dep) {
      deps.push(dep[1]);
    } else if (line.trim() && entries.length > 0 && !inDeps) {
      entries[entries.length - 1].summary += ` ${line.trim()}`;
    }
  }

  return { bump, entries, deps, firstRelease: sections.length === 1 };
}

async function main() {
  const pkgs = await getWorkspacePackages();
  const publicPkgs = pkgs.filter((p) => !p.private);
  const date = new Date().toISOString().slice(0, 10);
  const blocks = [];

  for (const pkg of publicPkgs) {
    const changelog = await fs.readFile(
      path.join(pkg.dir, "CHANGELOG.md"),
      "utf-8",
    );
    const { bump, entries, deps, firstRelease } = parseLatestSection(changelog);

    const label = firstRelease ? `${bump}, first release` : bump;
    const lines = [
      ...entries.map(
        (e) => `${e.summary.replace(/`/g, "").replace(/\.$/, "")} (#${e.pr})`,
      ),
      ...deps.map((d) => `Updated dependency: ${d}`),
    ];
    blocks.push(
      [
        `${pkg.name} ${pkg.version} (${label})`,
        ...lines.map((l) => `- ${l}`),
      ].join("\n"),
    );
  }

  console.log(`:rocket: DMK release ${date}\n\n${blocks.join("\n\n")}`);
}

main();
