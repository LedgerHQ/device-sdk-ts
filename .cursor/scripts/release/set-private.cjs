#!/usr/bin/env zx

require("zx/globals");
const {
  getWorkspacePackages,
  readChangesets,
  resolvePackageNames,
  ROOT,
} = require("./config.cjs");

async function main() {
  const raw = argv.packages;
  if (!raw) {
    console.error(chalk.red("Usage: set-private.cjs --packages dmk,signer-eth"));
    process.exit(1);
  }

  const requested = resolvePackageNames(raw.split(",").map((s) => s.trim()));
  const pkgs = await getWorkspacePackages();
  const releaseSet = new Set(requested);

  // --- Major-bump propagation ---
  const changesets = await readChangesets();
  const majors = new Set();

  for (const cs of changesets) {
    for (const [pkg, bump] of Object.entries(cs.packages)) {
      if (bump === "major" && releaseSet.has(pkg)) majors.add(pkg);
    }
  }

  if (majors.size > 0) {
    const nonSelected = pkgs.filter((p) => !releaseSet.has(p.name));
    const dependents = [];

    for (const pkg of nonSelected) {
      const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies };
      const majorDeps = [...majors].filter((m) => m in allDeps);
      if (majorDeps.length > 0) dependents.push({ pkg, majorDeps });
    }

    if (dependents.length > 0) {
      console.log(
        chalk.yellow(
          `Major bumps detected: ${[...majors].join(", ")}. Auto-including ${dependents.length} dependent(s).`,
        ),
      );

      const changesetDir = path.join(ROOT, ".changeset");
      const names = [];

      for (const { pkg } of dependents) {
        releaseSet.add(pkg.name);
        names.push(pkg.name);
        console.log(chalk.cyan(`  + ${pkg.name}`));
      }

      const changesetId = `dependent-packages-${Date.now()}`;
      const content = `---\n${names.map((n) => `"${n}": patch`).join("\n")}\n---\n\nBump packages due to major dependency updates\n`;
      await fs.writeFile(
        path.join(changesetDir, `${changesetId}.md`),
        content,
      );
      console.log(
        chalk.green(`Created changeset: .changeset/${changesetId}.md`),
      );
    }
  }

  // --- Set private flags ---
  const summary = { public: [], private: [] };

  for (const pkg of pkgs) {
    const json = await fs.readJson(pkg.path);
    const shouldBePublic = releaseSet.has(pkg.name);
    const newPrivate = !shouldBePublic;

    if (json.private !== newPrivate) {
      json.private = newPrivate;
      await fs.writeJson(pkg.path, json, { spaces: 2 });
    }

    if (shouldBePublic) {
      summary.public.push(pkg.name);
    } else {
      summary.private.push(pkg.name);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
