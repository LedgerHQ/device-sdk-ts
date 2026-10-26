// Reads the workspace: packages, manifests, files and the guardrails config of each package.

import { execFileSync } from "node:child_process";
import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generic } from "./roles/generic.mjs";
import { GROUPS } from "./groups.mjs";

export const CONFIG_FILE = "guardrails.config.mjs";
// Test code may cross layers and use dev dependencies. It isn't checked against [layers].
export const TEST_FILE =
  /(\.(test|spec)\.tsx?$)|(^|\/)__(test-utils|tests|mocks|fixtures)__\/|\.stories\.tsx?$/;
const INDEX_URL = new URL("./index.mjs", import.meta.url).href;

export function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`No pnpm-workspace.yaml found above ${start}`);
    }
    dir = parent;
  }
  return dir;
}

export function toPosix(p) {
  return p.split(path.sep).join("/");
}

// The `packages:` globs of pnpm-workspace.yaml.
function workspaceGlobs(root) {
  const yaml = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const globs = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^\S/.test(line)) inPackages = line.startsWith("packages:");
    else if (inPackages && line.trim().startsWith("- ")) {
      globs.push(
        line
          .trim()
          .slice(2)
          .replace(/^['"]|['"]$/g, ""),
      );
    }
  }
  return globs;
}

export function groupOf(dir) {
  return (
    GROUPS.find(([, globs]) =>
      globs.some((g) => path.matchesGlob(dir, g)),
    )?.[0] ?? null
  );
}

// Every workspace package: { dir, absDir, name, manifest, isPrivate, group }.
// `dir` is relative to the repo root, with forward slashes.
export function readWorkspace(root) {
  const dirs = workspaceGlobs(root)
    .flatMap((glob) => globSync(`${glob}/package.json`, { cwd: root }))
    .map((file) => toPosix(path.dirname(file)))
    .filter((dir) => !dir.split("/").includes("node_modules"));

  return [...new Set(dirs)].sort().map((dir) => {
    const absDir = path.join(root, dir);
    const manifest = JSON.parse(
      readFileSync(path.join(absDir, "package.json"), "utf8"),
    );
    return {
      dir,
      absDir,
      name: manifest.name,
      manifest,
      isPrivate: manifest.private === true,
      group: groupOf(dir),
    };
  });
}

// The package's files, relative to the package, with forward slashes.
// Tracked and untracked files count, ignored files don't: old build output and
// local leftovers can't produce noise, and a freshly generated kit is checked
// before anyone runs `git add`. Outside a git repository, the disk is read.
export function listFiles(absDir) {
  try {
    const out = execFileSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ".",
      ],
      { cwd: absDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out
      .split("\0")
      .filter(Boolean)
      .filter((file) => existsSync(path.join(absDir, file)))
      .sort();
  } catch {
    return walk(absDir, "").sort();
  }
}

function walk(absDir, rel) {
  return readdirSync(path.join(absDir, rel), { withFileTypes: true }).flatMap(
    (entry) => {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return ["node_modules", ".git", "lib", ".turbo"].includes(entry.name)
          ? []
          : walk(absDir, child);
      }
      return [child];
    },
  );
}

// The files changed against the base branch, relative to the repo root.
// Returns null when no base is known, which means "check everything".
export function changedFiles(root, base = process.env.TURBO_SCM_BASE) {
  if (!base) return null;
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  const mergeBase = git("merge-base", "HEAD", base)[0];
  return [
    ...git("diff", "--name-only", mergeBase),
    ...git("ls-files", "--others", "--exclude-standard"),
  ];
}

let hooksRegistered = false;

// Loads a package's guardrails.config.mjs. Returns the generic role when the
// package has none.
//
// The config imports "@ledgerhq/ldmk-tool/guardrails". A freshly generated kit
// has no node_modules yet, so this specifier is resolved here, to this copy of
// the guardrails.
export async function loadConfig(absDir) {
  const file = path.join(absDir, CONFIG_FILE);
  if (!existsSync(file)) {
    return { role: generic, extraFolders: [], exceptions: [], file: null };
  }
  if (!hooksRegistered) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        return specifier === "@ledgerhq/ldmk-tool/guardrails"
          ? { url: INDEX_URL, shortCircuit: true }
          : nextResolve(specifier, context);
      },
    });
    hooksRegistered = true;
  }
  const config = (await import(pathToFileURL(file).href)).default;
  if (!config?.role) {
    throw new Error(
      `${file}: the default export must be defineGuardrails({ role: … })`,
    );
  }
  return { ...config, file };
}
