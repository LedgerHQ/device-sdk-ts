// `ldmk-tool guardrails`: runs [deps] [layers] [tree] and prints one report.
//
//   ldmk-tool guardrails                    the package in the current directory
//   ldmk-tool guardrails --package <dir>    the same, from anywhere
//   ldmk-tool guardrails --repo             package.json checks for the packages
//                                           without a role, and the workspace graph
//   ldmk-tool guardrails --repo --affected  the same, for the packages changed
//                                           against TURBO_SCM_BASE
//   --strict                                fail if the package has exceptions or
//                                           extraFolders (used by generate-signer)
//
// A package with a role runs all its checks, including [deps] on its own
// package.json. --repo covers everything else, so nothing is reported twice.

import path from "node:path";

import { checkManifests } from "./check-deps.mjs";
import { checkImports } from "./check-imports.mjs";
import { checkGenericPackageFiles, checkTree } from "./check-tree.mjs";
import { formatAnnotations, formatReport } from "./report.mjs";
import {
  changedFiles,
  findRepoRoot,
  listFiles,
  loadConfig,
  readWorkspace,
  toPosix,
} from "./workspace.mjs";

// Returns the results, one per checked package.
export async function checkPackage(absDir, { strict = false } = {}) {
  const root = findRepoRoot(absDir);
  const workspace = await loadWorkspace(root);
  const dir = toPosix(path.relative(root, path.resolve(absDir)));
  const pkg = workspace.find((candidate) => candidate.dir === dir);
  if (!pkg) {
    throw new Error(
      `${dir} is not a workspace package (see pnpm-workspace.yaml)`,
    );
  }
  const byName = new Map(
    workspace.map((candidate) => [candidate.name, candidate]),
  );
  const manifestErrors = checkManifests(workspace).get(pkg.dir);
  const files = listFiles(pkg.absDir);

  if (pkg.config.role.kind === "generic") {
    return [
      finish(
        pkg,
        [...manifestErrors, ...checkGenericPackageFiles(pkg, files)],
        {
          strict,
        },
      ),
    ];
  }

  const tree = checkTree(pkg, files);
  const imports = await checkImports(pkg, files, byName);
  return [
    finish(pkg, [...manifestErrors, ...imports, ...tree.found], {
      strict,
      usedExtraFolders: tree.usedExtraFolders,
    }),
  ];
}

// The packages without a role, and the workspace graph.
export async function checkRepo(root, { affected = false } = {}) {
  const workspace = await loadWorkspace(root);
  const manifests = checkManifests(workspace);
  const scope = affected ? affectedDirs(root, workspace) : null;

  return workspace
    .map((pkg) => {
      const errors = manifests.get(pkg.dir);
      const hasRole = pkg.config.role.kind !== "generic";
      if (hasRole || (scope && !scope.has(pkg.dir))) {
        // The workspace graph is always checked: a cycle involves many packages.
        const cycles = errors.filter((v) => v.rule === "deps/no-cycles");
        return cycles.length ? finish(pkg, cycles) : null;
      }
      return finish(pkg, [
        ...errors,
        ...checkGenericPackageFiles(pkg, listFiles(pkg.absDir)),
      ]);
    })
    .filter(Boolean);
}

async function loadWorkspace(root) {
  const workspace = readWorkspace(root);
  for (const pkg of workspace) {
    try {
      pkg.config = await loadConfig(pkg.absDir);
    } catch (error) {
      throw new Error(
        `${pkg.dir}/guardrails.config.mjs is invalid: ${error.message}`,
      );
    }
  }
  return workspace;
}

// The packages that contain a changed file. A change to the rules themselves,
// or to the workspace definition, affects every package.
function affectedDirs(root, workspace) {
  const changed = changedFiles(root);
  const all = new Set(workspace.map((pkg) => pkg.dir));
  if (changed === null) return all;
  if (
    changed.some(
      (file) =>
        file.startsWith("packages/tools/ldmk-tool/guardrails/") ||
        file === "pnpm-workspace.yaml",
    )
  ) {
    return all;
  }
  return new Set(
    workspace
      .filter((pkg) => changed.some((file) => file.startsWith(`${pkg.dir}/`)))
      .map((pkg) => pkg.dir),
  );
}

// Applies the package's exceptions, and turns unused ones into warnings.
function finish(
  pkg,
  violations,
  { strict = false, usedExtraFolders = new Set() } = {},
) {
  const { exceptions, extraFolders, role } = pkg.config;
  const used = new Set();
  const errors = violations.filter((v) => {
    const index = exceptions.findIndex(
      (exception) =>
        exception.rule === v.rule &&
        path.matchesGlob(v.file ?? "", exception.path),
    );
    if (index === -1) return true;
    used.add(index);
    return false;
  });

  const warnings = [
    ...exceptions
      .filter((_, index) => !used.has(index))
      .map(
        (e) =>
          `unused exception: ${e.rule} on ${e.path}. Remove it from guardrails.config.mjs.`,
      ),
    ...(role.tree.allowedFolders
      ? extraFolders
          .filter(
            (entry) => !usedExtraFolders.has(entry.path.replace(/\/$/, "")),
          )
          .map(
            (e) =>
              `unused extraFolders entry: ${e.path}. Remove it from guardrails.config.mjs.`,
          )
      : []),
  ];

  if (strict && (exceptions.length > 0 || extraFolders.length > 0)) {
    errors.push({
      rule: "tree/package-files",
      file: "guardrails.config.mjs",
      detail:
        "--strict: a freshly generated kit must pass without exceptions or extraFolders",
    });
  }

  return {
    dir: pkg.dir,
    name: pkg.name,
    role: role.name,
    errors,
    warnings,
    exceptions: used.size,
  };
}

// The CLI. Returns the exit code.
export async function main({ packageDir, repo, affected, strict } = {}) {
  try {
    const results = repo
      ? await checkRepo(findRepoRoot(), { affected })
      : await checkPackage(path.resolve(packageDir ?? "."), { strict });
    const report = formatReport(results);
    console.log(report.text);
    if (process.env.GITHUB_ACTIONS === "true") {
      const annotations = formatAnnotations(results);
      if (annotations) console.log(annotations);
    }
    return report.errors > 0 ? 1 : 0;
  } catch (error) {
    console.error(`guardrails: ${error.message}`);
    return 2;
  }
}
