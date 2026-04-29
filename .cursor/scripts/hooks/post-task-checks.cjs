#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_LINES = 80;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function hasScript(pkgDir, scriptName) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"),
    );
    return !!(pkg.scripts && pkg.scripts[scriptName]);
  } catch {
    return false;
  }
}

function truncateOutput(output) {
  const lines = output.split("\n");
  if (lines.length > MAX_LINES) {
    return [
      `... (truncated, showing last ${MAX_LINES} of ${lines.length} lines) ...`,
      ...lines.slice(-MAX_LINES),
    ].join("\n");
  }
  return output;
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", ...opts });
}

function getChangedPackages() {
  const status = run("git status --porcelain");
  const packages = new Set();
  for (const line of status.split("\n")) {
    const file = line.trim().split(/\s+/).pop();
    if (file && file.startsWith("packages/")) {
      const parts = file.split("/");
      packages.add(parts.slice(0, 2).join("/"));
    }
  }
  return [...packages].sort();
}

function getPkgName(pkgDir) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"),
    );
    return pkg.name || pkgDir;
  } catch {
    return pkgDir;
  }
}

async function main() {
  const input = JSON.parse(await readStdin());

  if (input.status !== "completed") {
    console.log("{}");
    return;
  }

  const changedPackages = getChangedPackages();

  if (changedPackages.length === 0) {
    console.log("{}");
    return;
  }

  const errors = [];

  for (const pkgDir of changedPackages) {
    if (!fs.existsSync(path.join(pkgDir, "package.json"))) continue;

    const pkgName = getPkgName(pkgDir);

    // Tests (per-package)
    if (hasScript(pkgDir, "test")) {
      try {
        run("pnpm test", { cwd: pkgDir, stdio: "pipe" });
      } catch (e) {
        errors.push(`=== TEST FAILURES in ${pkgName} ===`);
        errors.push(truncateOutput(e.stdout || e.stderr || e.message));
        errors.push("");
      }
    }

    if (hasScript(pkgDir, "prettier:fix")) {
      try {
        run("pnpm prettier:fix", { cwd: pkgDir, stdio: "ignore" });
      } catch {
        // non-fatal
      }
    }

    if (hasScript(pkgDir, "typecheck")) {
      try {
        run("pnpm typecheck", { cwd: pkgDir, stdio: "pipe" });
      } catch (e) {
        errors.push(`=== TYPE ERRORS in ${pkgName} ===`);
        errors.push(truncateOutput(e.stdout || e.stderr || e.message));
        errors.push("");
      }
    }

    if (hasScript(pkgDir, "lint:fix")) {
      try {
        run("pnpm lint:fix", { cwd: pkgDir, stdio: "ignore" });
      } catch {
        // non-fatal
      }
    }

    if (hasScript(pkgDir, "lint")) {
      try {
        run("pnpm lint", { cwd: pkgDir, stdio: "pipe" });
      } catch (e) {
        errors.push(`=== LINT ERRORS in ${pkgName} ===`);
        errors.push(truncateOutput(e.stdout || e.stderr || e.message));
        errors.push("");
      }
    }
  }

  if (errors.length > 0) {
    const msg =
      "Post-task checks failed. Please fix the following issues and try again:\n\n" +
      errors.join("\n");
    console.log(JSON.stringify({ followup_message: msg }));
  } else {
    console.log("{}");
  }
}

main();
