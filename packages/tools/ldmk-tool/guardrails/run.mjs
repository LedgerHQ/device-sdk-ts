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
// package.json. --repo covers everything else: the packages without a role,
// the workspace graph, and the role packages missing their "guardrails" script
// (turbo would never run them). So nothing is reported twice.

import path from "node:path";

import { checkManifests, KINDS as DEPENDENCY_KINDS } from "./check-deps.mjs";
import { checkImports } from "./check-imports.mjs";
import { checkGenericPackageFiles, checkTree } from "./check-tree.mjs";
import { formatAnnotations, formatReport } from "./report.mjs";
import { isTreeRule } from "./rules.mjs";
import { generic } from "./roles/generic.mjs";
import {
  CONFIG_FILE,
  changedFiles,
  findRepoRoot,
  listFiles,
  loadConfig,
  readWorkspace,
  toPosix,
} from "./workspace.mjs";

// Rules only --repo reports: a cycle involves many packages.
const REPO_ONLY_RULES = new Set(["deps/no-cycles"]);

// Returns the results, one per checked package.
export async function checkPackage(absDir, { strict = false } = {}) {
  const root = findRepoRoot(absDir);
  const dir = toPosix(path.relative(root, path.resolve(absDir)));
  const workspace = await loadWorkspace(root, dir);
  const pkg = workspace.find((candidate) => candidate.dir === dir);
  if (!pkg) {
    throw new Error(
      dir
        ? `${dir} is not a workspace package (see pnpm-workspace.yaml)`
        : "the repo root is not a package: run it inside a package, or pass --package <dir> or --repo",
    );
  }
  const byName = new Map(
    workspace.map((candidate) => [candidate.name, candidate]),
  );
  const manifestErrors = checkManifests(workspace)
    .get(pkg.dir)
    .filter((v) => !REPO_ONLY_RULES.has(v.rule));
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
  const found = [
    ...manifestErrors,
    ...checkGuardrailsScript(pkg),
    ...imports,
    ...tree.found,
  ];
  return [
    finish(pkg, found, {
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
      if (pkg.config.invalid) {
        if (scope && !scope.has(pkg.dir)) return null;
        // Its own run stops on the error, and may never run at all.
        return finish(
          pkg,
          [
            {
              rule: "tree/guardrails-config",
              file: CONFIG_FILE,
              detail: pkg.config.invalid,
            },
            ...checkGuardrailsScript(pkg),
          ],
          { repo: true },
        );
      }
      const hasRole = pkg.config.role.kind !== "generic";
      // The workspace graph is always checked: a cycle involves many packages.
      const cycles = errors.filter((v) => REPO_ONLY_RULES.has(v.rule));
      const inScope = !scope || scope.has(pkg.dir);
      if (hasRole || !inScope) {
        const found =
          hasRole && inScope
            ? [...cycles, ...checkGuardrailsScript(pkg)]
            : cycles;
        const result = finish(pkg, found, { repo: true });
        // Listed only when --repo found, or excepted, something in it.
        const listed =
          result.errors.length > 0 ||
          result.warnings.length > 0 ||
          result.exceptions > 0;
        return listed ? result : null;
      }
      return finish(pkg, [
        ...errors,
        ...checkGenericPackageFiles(pkg, listFiles(pkg.absDir)),
      ]);
    })
    .filter(Boolean);
}

// Without the script, `turbo run guardrails` skips the package. With another
// command, it runs something else. Either way, none of its checks would run.
const GUARDRAILS_SCRIPT = "pnpm ldmk-tool guardrails";

function checkGuardrailsScript(pkg) {
  const script = pkg.manifest.scripts?.guardrails;
  if (script === GUARDRAILS_SCRIPT) return [];
  return [
    {
      rule: "tree/guardrails-script",
      file: "package.json",
      detail: script
        ? `the "guardrails" script must be "${GUARDRAILS_SCRIPT}", not "${script}"`
        : 'the "guardrails" script is missing',
    },
  ];
}

// Only the checked package's own config must be valid (`strictDir`). Another
// package with an invalid config is marked `invalid`: --repo reports it.
async function loadWorkspace(root, strictDir = null) {
  const workspace = readWorkspace(root);
  for (const pkg of workspace) {
    try {
      pkg.config = await loadConfig(pkg.absDir);
    } catch (error) {
      if (pkg.dir === strictDir) {
        throw new Error(
          `${pkg.dir}/guardrails.config.mjs is invalid: ${error.message}`,
        );
      }
      pkg.config = {
        role: { ...generic, name: "invalid config" },
        extraFolders: [],
        exceptions: [],
        file: path.join(pkg.absDir, CONFIG_FILE),
        invalid: error.message.replaceAll(`${pkg.absDir}${path.sep}`, ""),
      };
    }
  }
  return workspace;
}

// The packages that contain a changed file, and the packages that depend on
// them: [deps] also reads the target's package.json (is it private?). A change
// to the rules themselves, or to the workspace definition, affects every package.
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
  const touched = new Set(
    workspace
      .filter((pkg) => changed.some((file) => file.startsWith(`${pkg.dir}/`)))
      .map((pkg) => pkg.name),
  );
  return new Set(
    workspace
      .filter(
        (pkg) =>
          touched.has(pkg.name) ||
          DEPENDENCY_KINDS.some((kind) =>
            Object.keys(pkg.manifest[kind] ?? {}).some((name) =>
              touched.has(name),
            ),
          ),
      )
      .map((pkg) => pkg.dir),
  );
}

// [deps] and [layers] exceptions name one file, or one dependency
// ("package.json#<dependency>"), exactly. [tree] exceptions may use a glob.
function exceptionMatches(exception, violation) {
  if (exception.rule !== violation.rule) return false;
  const subject = violation.subject ?? violation.file ?? "";
  return isTreeRule(exception.rule)
    ? path.matchesGlob(subject, exception.path)
    : subject === exception.path;
}

// Applies the package's exceptions, and turns unused ones into warnings.
function finish(
  pkg,
  violations,
  { strict = false, usedExtraFolders = new Set(), repo = false } = {},
) {
  const { exceptions, extraFolders, role } = pkg.config;
  const used = new Set();
  const errors = violations.filter((v) => {
    const index = exceptions.findIndex((exception) =>
      exceptionMatches(exception, v),
    );
    if (index === -1) return true;
    used.add(index);
    return false;
  });

  // Each run reports the unused entries of the rules it checks: --repo the
  // repo-only rules, the package's own run everything else.
  const unused = [
    ...exceptions
      .filter(
        (e, index) => !used.has(index) && REPO_ONLY_RULES.has(e.rule) === repo,
      )
      .map((e) => `unused exception: ${e.rule} on ${e.path}.`),
    ...(repo ? [] : extraFolders)
      .filter((entry) => !usedExtraFolders.has(entry.path.replace(/\/$/, "")))
      .map((e) => `unused extraFolders entry: ${e.path}.`),
  ];
  const warnings = unused.map(
    (text) => `${text} Remove it from guardrails.config.mjs.`,
  );

  if (strict && (exceptions.length > 0 || extraFolders.length > 0)) {
    errors.push({
      rule: "tree/strict",
      file: "guardrails.config.mjs",
      detail: "the package has exceptions or extraFolders",
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

const FLAGS = ["_", "package", "repo", "affected", "strict"];

// For the annotations only: if git can't tell, every file is annotated.
function changedFilesOrAll() {
  try {
    return changedFiles(findRepoRoot());
  } catch {
    return null;
  }
}

// The CLI flags, as minimist gives them: `--repo=false` is the string "false".
function readFlags(argv) {
  const flag = (name) => {
    const value = argv[name];
    if (value === undefined || value === false || value === "false") {
      return false;
    }
    if (value === true || value === "true") return true;
    throw new Error(`--${name} takes no value`);
  };
  const unknown = Object.keys(argv).filter((key) => !FLAGS.includes(key));
  const extra = (argv._ ?? []).slice(1);
  if (unknown.length > 0 || extra.length > 0) {
    throw new Error(
      `unknown argument(s): ${[...unknown.map((key) => `--${key}`), ...extra].join(", ")}`,
    );
  }
  const flags = {
    packageDir: argv.package,
    repo: flag("repo"),
    affected: flag("affected"),
    strict: flag("strict"),
  };
  const problems = [
    flags.packageDir !== undefined &&
      typeof flags.packageDir !== "string" &&
      "--package needs a directory",
    flags.packageDir !== undefined &&
      flags.repo &&
      "--package and --repo can't be combined",
    flags.affected && !flags.repo && "--affected only works with --repo",
    flags.strict && flags.repo && "--strict only works on one package",
  ].filter(Boolean);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return flags;
}

// The CLI. `argv` is minimist's output. Returns the exit code.
export async function main(argv = {}) {
  try {
    const { packageDir, repo, affected, strict } = readFlags(argv);
    const results = repo
      ? await checkRepo(findRepoRoot(), { affected })
      : await checkPackage(path.resolve(packageDir ?? "."), { strict });
    const report = formatReport(results);
    console.log(report.text);
    if (process.env.GITHUB_ACTIONS === "true") {
      const annotations = formatAnnotations(results, changedFilesOrAll());
      if (annotations) console.log(annotations);
    }
    return report.errors > 0 ? 1 : 0;
  } catch (error) {
    console.error(`guardrails: ${error.message}`);
    return 2;
  }
}
