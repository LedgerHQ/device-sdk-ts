#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXCLUDED_DIRS = ["node_modules", "lib", ".next", "dist"];

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

async function main() {
  const input = JSON.parse(await readStdin());
  const filePath = input.file_path;

  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const parts = filePath.split(path.sep);
  if (EXCLUDED_DIRS.some((dir) => parts.includes(dir))) {
    return;
  }

  try {
    execSync(`pnpm exec prettier --write "${filePath}"`, { stdio: "ignore" });
  } catch {
    // Prettier failure is non-fatal
  }
}

main();
