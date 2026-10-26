// [deps] Dependencies, checked on package.json, for the whole workspace.

import { allowedKinds } from "./edges.mjs";
import { ROLE_GROUPS } from "./groups.mjs";

const CORE = "@ledgerhq/device-management-kit";
const CONTEXT_MODULE = "@ledgerhq/context-module";
export const KINDS = ["dependencies", "peerDependencies", "devDependencies"];

// `dependency` is the dependency the violation is about, if any. An exception
// must name it: its path is "package.json#<dependency>".
function violation(rule, detail, dependency) {
  return {
    rule,
    file: "package.json",
    detail,
    ...(dependency ? { subject: `package.json#${dependency}` } : {}),
  };
}

// `packages` come from readWorkspace(), each with its loaded `config`.
// Returns the violations of each package, keyed by package dir.
export function checkManifests(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const result = new Map(packages.map((pkg) => [pkg.dir, []]));

  for (const pkg of packages) {
    const found = result.get(pkg.dir);
    const deps = (kind) => pkg.manifest[kind] ?? {};
    const has = (kind, name) => Object.hasOwn(deps(kind), name);

    // deps/group-declared
    if (!pkg.group) {
      found.push(
        violation(
          "deps/group-declared",
          "matches no group in ldmk-tool/guardrails/groups.mjs",
        ),
      );
    } else if (ROLE_GROUPS.includes(pkg.group) && !pkg.config.file) {
      found.push(
        violation(
          "deps/group-declared",
          `its path makes it a ${pkg.group}, but it has no guardrails.config.mjs`,
        ),
      );
    } else if (pkg.config.role.group && pkg.config.role.group !== pkg.group) {
      found.push(
        violation(
          "deps/group-declared",
          `guardrails.config.mjs picks the role ${pkg.config.role.name}, but its path makes it a ${pkg.group}`,
        ),
      );
    }

    // Edges to other workspace packages.
    for (const kind of KINDS) {
      for (const name of Object.keys(deps(kind)).sort()) {
        const target = byName.get(name);
        if (!target || !pkg.group || !target.group) continue;

        if (name === CORE && kind === "dependencies" && pkg.group !== "app") {
          found.push(
            violation("deps/core-is-peer", `${name} is in dependencies`, name),
          );
          continue;
        }
        const allowed = allowedKinds(pkg.group, target.group, target.dir);
        if (!allowed.includes(kind)) {
          found.push(
            violation(
              "deps/edge-allowed",
              allowed.length === 0
                ? `${pkg.group} → ${target.group} is not allowed: ${name} (${kind})`
                : `${pkg.group} → ${target.group} is only allowed in ${allowed.join(" or ")}: ${name} is in ${kind}`,
              name,
            ),
          );
        }
        if (!pkg.isPrivate && target.isPrivate && kind !== "devDependencies") {
          found.push(
            violation(
              "deps/no-public-to-private",
              `${name} is private, but it is in ${kind}`,
              name,
            ),
          );
        }
      }
    }

    // deps/core-is-peer: the peer dependency needs its local copy.
    if (has("peerDependencies", CORE) && !has("devDependencies", CORE)) {
      found.push(
        violation(
          "deps/core-is-peer",
          `${CORE} is in peerDependencies but not in devDependencies`,
          CORE,
        ),
      );
    }

    // deps/no-duplicate-kind
    for (const name of Object.keys(deps("dependencies")).sort()) {
      if (has("peerDependencies", name)) {
        found.push(
          violation(
            "deps/no-duplicate-kind",
            `${name} is in both dependencies and peerDependencies`,
            name,
          ),
        );
      }
    }

    // deps/context-module-kind
    if (pkg.group === "signerKit") {
      const inDeps = has("dependencies", CONTEXT_MODULE);
      const inPeer = has("peerDependencies", CONTEXT_MODULE);
      const inDev = has("devDependencies", CONTEXT_MODULE);
      const runtimeForm = inDeps && !inPeer && !inDev;
      const peerForm = !inDeps && inPeer && inDev;
      if ((inDeps || inPeer || inDev) && !runtimeForm && !peerForm) {
        const kinds = KINDS.filter((kind) => has(kind, CONTEXT_MODULE));
        found.push(
          violation(
            "deps/context-module-kind",
            `${CONTEXT_MODULE} is in ${kinds.join(" + ")}`,
            CONTEXT_MODULE,
          ),
        );
      }
    }
  }

  // deps/no-cycles, over every kind of edge: Turbo builds dev dependencies first too.
  for (const cycle of findCycles(packages, byName)) {
    result
      .get(cycle[0])
      .push(
        violation(
          "deps/no-cycles",
          `these packages depend on each other: ${cycle.join(", ")}`,
        ),
      );
  }

  return result;
}

// The groups of packages that depend on each other (strongly connected
// components with more than one package, or a package depending on itself),
// found with Tarjan's algorithm.
function findCycles(packages, byName) {
  const edges = new Map(
    packages.map((pkg) => [
      pkg.dir,
      KINDS.flatMap((kind) => Object.keys(pkg.manifest[kind] ?? {}))
        .map((name) => byName.get(name)?.dir)
        .filter(Boolean),
    ]),
  );
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let counter = 0;

  const connect = (dir) => {
    index.set(dir, counter);
    low.set(dir, counter);
    counter += 1;
    stack.push(dir);
    onStack.add(dir);
    for (const next of edges.get(dir)) {
      if (!index.has(next)) {
        connect(next);
        low.set(dir, Math.min(low.get(dir), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(dir, Math.min(low.get(dir), index.get(next)));
      }
    }
    if (low.get(dir) === index.get(dir)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== dir);
      if (component.length > 1 || edges.get(dir).includes(dir)) {
        cycles.push(component.sort());
      }
    }
  };
  for (const pkg of packages) if (!index.has(pkg.dir)) connect(pkg.dir);
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}
