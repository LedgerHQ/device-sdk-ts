// [deps] Dependencies and [layers] Layers, checked on the real import lines with dependency-cruiser.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";

import { allowedKinds } from "./edges.mjs";
import { TEST_FILE } from "./workspace.mjs";

const KINDS = ["dependencies", "peerDependencies", "devDependencies"];

const matches = (file, globs) => globs.some((g) => path.matchesGlob(file, g));

// Runs dependency-cruiser on the package's src/ folder. Also returns the
// tsconfig `paths`, the aliases the package imports with.
async function cruisePackage(absDir) {
  const tsconfigFile = path.join(absDir, "tsconfig.json");
  const hasTsconfig = existsSync(tsconfigFile);
  const tsconfig = hasTsconfig ? parseTsconfig(tsconfigFile) : undefined;
  const previousDir = process.cwd();
  process.chdir(absDir);
  try {
    const result = await cruise(
      ["src"],
      {
        // Without validate, cruise() runs no rules and silently reports no cycles.
        validate: true,
        // Keeps type-only imports visible, and marks them "type-only".
        tsPreCompilationDeps: true,
        doNotFollow: { path: "node_modules" },
        ...(hasTsconfig ? { tsConfig: { fileName: "tsconfig.json" } } : {}),
        ruleSet: {
          forbidden: [
            {
              name: "no-circular",
              severity: "error",
              from: {},
              to: {
                circular: true,
                viaOnly: { dependencyTypesNot: ["type-only"] },
              },
            },
          ],
        },
      },
      undefined,
      tsconfig ? { tsConfig: tsconfig } : undefined,
    );
    return { output: result.output, paths: tsconfig?.options.paths ?? {} };
  } finally {
    process.chdir(previousDir);
  }
}

// The full tsconfig, or, when its `extends` can't be resolved (a freshly
// generated kit has no node_modules yet), only the local baseUrl and paths,
// which are all the import resolution needs.
function parseTsconfig(file) {
  try {
    return extractTSConfig(file);
  } catch {
    const { compilerOptions = {} } = JSON.parse(readFileSync(file, "utf8"));
    // Without its `paths`, the aliases can't be told apart from packages, and
    // [layers] would pass with nothing checked.
    if (!compilerOptions.paths) {
      throw new Error(
        `${file}: its "extends" can't be resolved, and it has no "paths" of its own. Run pnpm install, or declare "paths" in this file.`,
      );
    }
    return {
      options: {
        baseUrl: path.resolve(
          path.dirname(file),
          compilerOptions.baseUrl ?? ".",
        ),
        paths: compilerOptions.paths,
      },
    };
  }
}

// Every check below skips the imports dependency-cruiser couldn't resolve. If a
// relative or alias import doesn't resolve (a broken tsconfig `paths`, for
// example), [layers] would pass with nothing checked, so the run stops instead.
function failOnUnresolved(pkg, output, known, paths) {
  const aliases = Object.keys(paths).map((alias) => alias.replace(/\*$/, ""));
  const isLocal = (specifier) =>
    specifier.startsWith(".") ||
    aliases.some((alias) => specifier.startsWith(alias));
  const unresolved = output.modules
    .filter((mod) => known.has(mod.source))
    .flatMap((mod) =>
      mod.dependencies
        .filter((dep) => dep.couldNotResolve && isLocal(dep.module))
        .map((dep) => `${mod.source} imports "${dep.module}"`),
    );
  if (unresolved.length > 0) {
    throw new Error(
      `${pkg.dir}: ${unresolved.length} import(s) can't be resolved, so [layers] can't be checked. Fix the import or the tsconfig.json "paths": ${unresolved.join("; ")}`,
    );
  }
}

// The layer of a file: the first layer of the role whose paths match it.
function layerOf(role, file) {
  return role.layers.find(([, globs]) => matches(file, globs))?.[0] ?? "other";
}

// `pkg` comes from readWorkspace(), with its loaded `config`.
// `files` is the package's file list, `byName` maps package names to packages.
export async function checkImports(pkg, files, byName) {
  const { role } = pkg.config;
  if (!files.some((file) => file.startsWith("src/"))) return [];

  const { output, paths } = await cruisePackage(pkg.absDir);
  const known = new Set(files);
  failOnUnresolved(pkg, output, known, paths);
  const found = [];
  // `subject` is what an exception must name, when it isn't the file.
  const report = (rule, file, detail, specifier, subject) =>
    found.push({
      rule,
      file,
      detail,
      line: lineOf(pkg.absDir, file, specifier),
      ...(subject ? { subject } : {}),
    });

  for (const mod of output.modules) {
    if (!known.has(mod.source)) continue;
    const isTest = TEST_FILE.test(mod.source);

    for (const dep of mod.dependencies) {
      if (dep.module.startsWith("@ledgerhq/")) {
        checkPackageImport(pkg, mod.source, dep, isTest, byName, report);
        continue;
      }
      if (isTest || !known.has(dep.resolved)) continue;
      const typeOnly = dep.dependencyTypes.includes("type-only");
      if (role.kind === "signer") {
        checkSignerLayers(role, mod.source, dep, typeOnly, report);
      } else if (role.kind === "transport") {
        if (
          mod.source === "src/index.ts" &&
          dep.resolved.startsWith("src/internal/")
        ) {
          report(
            "layers/internal-not-exported",
            mod.source,
            `exports ${dep.resolved}`,
            dep.module,
          );
        }
      }
    }
  }

  // layers/no-circular, runtime imports only. Each cycle is reported once.
  const cycles = new Map();
  for (const v of output.summary.violations) {
    if (v.rule.name !== "no-circular") continue;
    const chain = [v.from, ...v.cycle.map((step) => step.name)];
    if (chain.some((file) => TEST_FILE.test(file) || !known.has(file)))
      continue;
    const key = [...new Set(chain)].sort().join(" ");
    if (!cycles.has(key)) cycles.set(key, chain);
  }
  for (const chain of cycles.values()) {
    report("layers/no-circular", chain[0], chain.join(" → "));
  }

  return found;
}

// [deps] on imports of other @ledgerhq packages.
function checkPackageImport(pkg, source, dep, isTest, byName, report) {
  const name = dep.module.split("/").slice(0, 2).join("/");
  if (name === pkg.name) return;

  if (dep.module !== name) {
    report("deps/no-deep", source, `imports ${dep.module}`, dep.module);
  }
  if (!KINDS.some((kind) => Object.hasOwn(pkg.manifest[kind] ?? {}, name))) {
    report(
      "deps/declared",
      source,
      `imports ${name}, which is not in package.json`,
      dep.module,
    );
    return;
  }
  const target = byName.get(name);
  if (!target?.group || !pkg.group) return;
  const allowed = allowedKinds(pkg.group, target.group, target.dir);
  if (allowed.length === 0) {
    report(
      "deps/edge-allowed",
      source,
      `imports ${name}: ${pkg.group} → ${target.group} is not allowed`,
      dep.module,
      `package.json#${name}`,
    );
  } else if (
    !isTest &&
    allowed.length === 1 &&
    allowed[0] === "devDependencies"
  ) {
    report(
      "deps/edge-allowed",
      source,
      `imports ${name} in production code, but ${pkg.group} → ${target.group} is for devDependencies only`,
      dep.module,
      `package.json#${name}`,
    );
  }
}

// [layers] for signer kits.
function checkSignerLayers(role, source, dep, typeOnly, report) {
  const to = dep.resolved;
  const from = layerOf(role, source);
  const target = layerOf(role, to);
  const imports = `imports ${to}${typeOnly ? " (type)" : ""}`;

  if (from === "index" && to !== "src/api/index.ts") {
    report("layers/index-only-api", source, imports, dep.module);
  }

  if (
    from === "api" &&
    to.startsWith("src/internal/") &&
    !typeOnly &&
    !matches(source, role.apiMayCreate)
  ) {
    report("layers/api-internal-type-only", source, imports, dep.module);
  }

  if (from === "command") {
    if (
      [
        "DefaultSigner",
        "use-cases",
        "app-binder",
        "device-action",
        "task",
        "service",
      ].includes(target)
    ) {
      report(
        "layers/command-is-leaf",
        source,
        `${imports}, which is in the ${target} layer`,
        dep.module,
      );
    }
    if (isTopLevelCommand(source) && isTopLevelCommand(to) && to !== source) {
      report("layers/command-no-command", source, imports, dep.module);
    }
    return;
  }

  if (matches(to, role.diTokens)) return;

  const fromRank = role.ladder.indexOf(from);
  const toRank = role.ladder.indexOf(target);
  if (fromRank > 0 && toRank >= 0 && toRank < fromRank) {
    report(
      "layers/ladder",
      source,
      `${imports}: ${from} may not import ${target}, which is above it`,
      dep.module,
    );
  } else if (["domain", "service"].includes(from) && target === "use-cases") {
    report(
      "layers/ladder",
      source,
      `${imports}: ${from} code may not import use cases`,
      dep.module,
    );
  }
}

function isTopLevelCommand(file) {
  return /^src\/internal\/app-binder\/command\/[^/]+Command\.ts$/.test(file);
}

const texts = new Map();

// The 1-based line where a file imports `specifier`, for the GitHub annotation.
function lineOf(absDir, file, specifier) {
  if (!specifier) return undefined;
  const abs = path.join(absDir, file);
  if (!texts.has(abs)) texts.set(abs, readFileSync(abs, "utf8").split("\n"));
  const index = texts
    .get(abs)
    .findIndex(
      (text) =>
        text.includes(`"${specifier}"`) || text.includes(`'${specifier}'`),
    );
  return index >= 0 ? index + 1 : undefined;
}
