#!/usr/bin/env zx

require("zx/globals");

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail });
  } catch (err) {
    checks.push({ name, pass: false, detail: err.message || String(err) });
  }
}

async function main() {
  $.verbose = false;

  await check("git", async () => {
    const v = await $`git --version`;
    return v.stdout.trim().replace("git version ", "");
  });

  await check("git repo", async () => {
    await $`git rev-parse --is-inside-work-tree`;
    return "detected";
  });

  await check("gh", async () => {
    const v = await $`gh --version`;
    const first = v.stdout.trim().split("\n")[0];
    return first.replace("gh version ", "").replace(/ \(.*\)/, "");
  });

  await check("gh auth", async () => {
    const r = await $`gh auth status 2>&1`;
    const output = r.stdout.trim();
    const match = output.match(/Logged in to [^\s]+ account (\S+)/);
    return match ? `authenticated as ${match[1]}` : "authenticated";
  });

  await check("pnpm", async () => {
    const v = await $`pnpm --version`;
    return v.stdout.trim();
  });

  await check("semver", async () => {
    try {
      require("semver");
    } catch {
      throw new Error("semver npm package not found — run pnpm install");
    }
    return "available";
  });

  let failed = false;
  for (const c of checks) {
    const tag = c.pass ? chalk.green("[pass]") : chalk.red("[FAIL]");
    console.log(`${tag} ${c.name} ${c.detail}`);
    if (!c.pass) failed = true;
  }

  if (failed) {
    console.log(chalk.red("\nPreflight failed. Fix the issues above before proceeding."));
    process.exit(1);
  }

  console.log(chalk.green("\nAll checks passed. Ready to release."));
}

main();
