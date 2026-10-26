// Runs `ldmk-tool guardrails` as a real process on a temporary workspace, the way CI does.
// The fixture kit has no node_modules, like a freshly generated kit: its
// guardrails.config.mjs and tsconfig.json must still load.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  goodKitFiles,
  kitManifest,
  makeTempDir,
  writeFiles,
} from "./fixtures.mjs";

const CLI = fileURLToPath(new URL("../../cli.cjs", import.meta.url));
const KIT = "packages/signer/signer-foo";

let temp;
beforeEach(() => {
  temp = makeTempDir();
  writeFiles(temp.dir, {
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n  - packages/signer/*\n",
    [`${KIT}/package.json`]: JSON.stringify(kitManifest(), null, 2),
  });
  writeFiles(path.join(temp.dir, KIT), goodKitFiles());
});
afterEach(() => temp.cleanup());

function guardrails(args, env = {}) {
  // Annotations are only printed when a test asks for them.
  const baseEnv = { ...process.env, NO_COLOR: "1" };
  delete baseEnv.GITHUB_ACTIONS;
  // CI sets FORCE_COLOR, which wins over NO_COLOR, and TURBO_SCM_BASE, which
  // the temporary workspace doesn't have. Tests that need them set them.
  delete baseEnv.FORCE_COLOR;
  delete baseEnv.TURBO_SCM_BASE;
  const result = spawnSync(process.execPath, [CLI, "guardrails", ...args], {
    cwd: temp.dir,
    encoding: "utf8",
    env: { ...baseEnv, ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function git(cwd, ...args) {
  return spawnSync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" },
  );
}

// Turns the temporary workspace into a git repository on "main", with everything committed.
function commitAll(cwd) {
  git(cwd, "init", "-q", "-b", "main");
  git(cwd, "add", ".");
  git(cwd, "commit", "-q", "-m", "base");
}

function setConfig(body) {
  writeFileSync(
    path.join(temp.dir, KIT, "guardrails.config.mjs"),
    `import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";\n\nexport default defineGuardrails(${body});\n`,
  );
}

const breakTaskName = () =>
  writeFiles(path.join(temp.dir, KIT), {
    "src/internal/app-binder/task/Helpers.ts": "export const x = 1;\n",
  });

describe("ldmk-tool guardrails", () => {
  it("passes a well-formed kit, without node_modules", () => {
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain(
      "✔ @ledgerhq/device-signer-kit-foo  (role: signerKit)",
    );
    expect(out).toContain("0 errors · 0 warnings · 0 exceptions");
    expect(code).toBe(0);
  });

  it("fails with a clear message", () => {
    breakTaskName();
    const { code, out } = guardrails(["--package", KIT]);
    expect(code).toBe(1);
    expect(out).toContain(
      "✖ @ledgerhq/device-signer-kit-foo  (role: signerKit)",
    );
    expect(out).toContain("[tree] tree/task-name");
    expect(out).toContain("src/internal/app-binder/task/Helpers.ts");
    expect(out).toContain("Why:");
    expect(out).toContain("Fix:");
    expect(out).toContain(
      "Docs: packages/tools/ldmk-tool/guardrails/README.md#treetask-name",
    );
  });

  it("prints GitHub annotations inside GitHub Actions", () => {
    breakTaskName();
    const { out } = guardrails(["--package", KIT], { GITHUB_ACTIONS: "true" });
    expect(out).toContain(
      `::error file=${KIT}/src/internal/app-binder/task/Helpers.ts,title=tree/task-name::`,
    );
  });

  it("only annotates the files changed against TURBO_SCM_BASE", () => {
    commitAll(temp.dir);
    git(temp.dir, "switch", "-q", "-c", "feature");
    breakTaskName();
    writeFiles(path.join(temp.dir, KIT), {
      "src/internal/app-binder/task/Other.ts": "export const y = 1;\n",
    });
    git(temp.dir, "add", ".");
    git(temp.dir, "commit", "-q", "-m", "change");
    git(temp.dir, "switch", "-q", "-c", "next");
    writeFiles(path.join(temp.dir, KIT), {
      "src/internal/app-binder/task/Helpers.ts": "export const x = 2;\n",
    });
    const { out } = guardrails(["--package", KIT], {
      GITHUB_ACTIONS: "true",
      TURBO_SCM_BASE: "feature",
    });
    expect(out).toContain("title=tree/task-name::");
    expect(out).toContain("task/Helpers.ts,title");
    expect(out).not.toContain("task/Other.ts,title");
    // Both are still in the report itself.
    expect(out).toContain("src/internal/app-binder/task/Other.ts");
  });

  it("lets an exception with a reason lift one rule for some files", () => {
    breakTaskName();
    setConfig(
      `{ role: signerKit, exceptions: [{ rule: "tree/task-name", path: "src/internal/app-binder/task/Helpers.ts", reason: "test" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("0 errors · 0 warnings · 1 exception");
    expect(code).toBe(0);
  });

  it("warns about unused exceptions and extraFolders, without failing", () => {
    setConfig(
      `{ role: signerKit, extraFolders: [{ path: "src/internal/gone", reason: "test" }], exceptions: [{ rule: "tree/task-name", path: "src/x.ts", reason: "test" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("unused exception: tree/task-name on src/x.ts");
    expect(out).toContain("unused extraFolders entry: src/internal/gone");
    expect(code).toBe(0);
  });

  it("--strict rejects exceptions and extraFolders", () => {
    setConfig(
      `{ role: signerKit, extraFolders: [{ path: "src/internal/x", reason: "test" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT, "--strict"]);
    expect(out).toContain("[tree] tree/strict");
    expect(out).toContain("README.md#treestrict");
    expect(code).toBe(1);
  });

  it("reports an invalid config", () => {
    setConfig(
      `{ role: signerKit, extraFolders: [{ path: "src/internal/x" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain('extraFolders[0] needs a "reason"');
    expect(code).toBe(2);
  });

  it("validates a config that skips defineGuardrails()", () => {
    writeFileSync(
      path.join(temp.dir, KIT, "guardrails.config.mjs"),
      'export default { role: { name: "signerKit" }, extraFolders: "x" };\n',
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain('"extraFolders" must be a list');
    expect(code).toBe(2);
  });

  it("--repo --affected only reports the packages changed against TURBO_SCM_BASE", () => {
    const generic = (name) => ({
      [`packages/${name}/package.json`]: JSON.stringify({
        name: `@ledgerhq/${name}`,
        private: false,
      }),
      [`packages/${name}/CHANGELOG.md`]: "# Changelog\n",
    });
    writeFiles(temp.dir, { ...generic("touched"), ...generic("untouched") });
    commitAll(temp.dir);
    git(temp.dir, "switch", "-q", "-c", "feature");
    writeFiles(temp.dir, { "packages/touched/index.js": "export {};\n" });

    const { code, out } = guardrails(["--repo", "--affected"], {
      TURBO_SCM_BASE: "main",
    });
    expect(out).toContain("✖ @ledgerhq/touched");
    expect(out).not.toContain("@ledgerhq/untouched");
    expect(code).toBe(1);
  });

  it("--repo --affected also reports the packages that depend on a changed one", () => {
    writeFiles(temp.dir, {
      "packages/signer/signer-utils/package.json": JSON.stringify({
        name: "@ledgerhq/signer-utils",
        private: false,
      }),
      "packages/signer/signer-utils/README.md": "# Signer utils\n",
      "packages/signer/signer-utils/CHANGELOG.md": "# Changelog\n",
      "packages/device-contacts-kit/package.json": JSON.stringify({
        name: "@ledgerhq/device-contacts-kit",
        private: false,
        dependencies: { "@ledgerhq/signer-utils": "workspace:^" },
      }),
      "packages/device-contacts-kit/README.md": "# Contacts\n",
      "packages/device-contacts-kit/CHANGELOG.md": "# Changelog\n",
    });
    commitAll(temp.dir);
    git(temp.dir, "switch", "-q", "-c", "feature");
    writeFiles(temp.dir, {
      "packages/signer/signer-utils/package.json": JSON.stringify({
        name: "@ledgerhq/signer-utils",
        private: true,
      }),
    });

    const { code, out } = guardrails(["--repo", "--affected"], {
      TURBO_SCM_BASE: "main",
    });
    expect(out).toContain("✖ @ledgerhq/device-contacts-kit");
    expect(out).toContain("deps/no-public-to-private");
    expect(code).toBe(1);
  });

  it("--repo reports a kit without the guardrails script", () => {
    const { scripts } = kitManifest();
    delete scripts.guardrails;
    writeFiles(temp.dir, {
      [`${KIT}/package.json`]: JSON.stringify(kitManifest({ scripts })),
    });
    const { code, out } = guardrails(["--repo"]);
    expect(out).toContain("✖ @ledgerhq/device-signer-kit-foo");
    expect(out).toContain("tree/guardrails-script");
    expect(out).toContain('the "guardrails" script is missing');
    expect(code).toBe(1);
  });

  it("reports a cycle once, from --repo, without unused-entry warnings", () => {
    setConfig(
      `{ role: signerKit, extraFolders: [{ path: "src/internal/gone", reason: "test" }] }`,
    );
    writeFiles(temp.dir, {
      [`${KIT}/package.json`]: JSON.stringify(
        kitManifest({
          dependencies: {
            "@ledgerhq/signer-utils": "workspace:^",
            "@ledgerhq/device-signer-kit-foo": "workspace:^",
          },
        }),
      ),
    });

    const repo = guardrails(["--repo"]);
    expect(repo.out).toContain("deps/no-cycles");
    expect(repo.out).not.toContain("unused");
    expect(repo.code).toBe(1);

    const own = guardrails(["--package", KIT]);
    expect(own.out).not.toContain("deps/no-cycles");
    expect(own.out).toContain("unused extraFolders entry: src/internal/gone");
  });

  it("reports an unused cycle exception from --repo only", () => {
    setConfig(
      `{ role: signerKit, exceptions: [{ rule: "deps/no-cycles", path: "package.json", reason: "test" }] }`,
    );
    const selfDependency = () =>
      writeFiles(temp.dir, {
        [`${KIT}/package.json`]: JSON.stringify(
          kitManifest({
            dependencies: {
              "@ledgerhq/signer-utils": "workspace:^",
              "@ledgerhq/device-signer-kit-foo": "workspace:^",
            },
          }),
        ),
      });

    expect(guardrails(["--package", KIT]).out).not.toContain("unused");
    expect(guardrails(["--repo"]).out).toContain(
      "unused exception: deps/no-cycles on package.json",
    );

    selfDependency();
    expect(guardrails(["--package", KIT]).out).not.toContain("unused");
    const repo = guardrails(["--repo"]);
    expect(repo.out).toContain("0 errors · 0 warnings · 1 exception");
    expect(repo.code).toBe(0);
  });

  it("--repo --affected checks every package when the rules change", () => {
    writeFiles(temp.dir, {
      "packages/device-contacts-kit/package.json": JSON.stringify({
        name: "@ledgerhq/device-contacts-kit",
        private: false,
      }),
    });
    commitAll(temp.dir);
    git(temp.dir, "switch", "-q", "-c", "feature");
    writeFiles(temp.dir, {
      "packages/tools/ldmk-tool/guardrails/rules.mjs": "export {};\n",
    });

    const { code, out } = guardrails(["--repo", "--affected"], {
      TURBO_SCM_BASE: "main",
    });
    expect(out).toContain("✖ @ledgerhq/device-contacts-kit");
    expect(code).toBe(1);
  });

  it("explains how to run it at the repo root", () => {
    const { code, out } = guardrails([]);
    expect(out).toContain(
      "run it inside a package, or pass --package <dir> or --repo",
    );
    expect(code).toBe(2);
  });

  it("stops when a local import can't be resolved", () => {
    writeFiles(path.join(temp.dir, KIT), {
      "src/internal/Broken.ts": 'export { x } from "@internal/missing";\n',
    });
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain('src/internal/Broken.ts imports "@internal/missing"');
    expect(code).toBe(2);
  });

  it("lifts a [deps] rule for the dependency the exception names, and no other", () => {
    const privatePackage = (dir, name) => ({
      [`${dir}/package.json`]: JSON.stringify({ name, private: true }),
    });
    writeFiles(temp.dir, {
      ...privatePackage(
        "packages/signer/signer-utils",
        "@ledgerhq/signer-utils",
      ),
      ...privatePackage(
        "packages/device-contacts-kit",
        "@ledgerhq/device-contacts-kit",
      ),
      [`${KIT}/package.json`]: JSON.stringify(
        kitManifest({
          dependencies: {
            "@ledgerhq/signer-utils": "workspace:^",
            "@ledgerhq/device-contacts-kit": "workspace:^",
          },
        }),
      ),
    });
    setConfig(
      `{ role: signerKit, exceptions: [{ rule: "deps/no-public-to-private", path: "package.json#@ledgerhq/signer-utils", reason: "test" }] }`,
    );

    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("@ledgerhq/device-contacts-kit is private");
    expect(out).not.toContain("@ledgerhq/signer-utils is private");
    expect(out).toContain("1 error · 0 warnings · 1 exception");
    expect(code).toBe(1);
  });

  it("lifts a [tree] rule for every file a glob matches", () => {
    breakTaskName();
    setConfig(
      `{ role: signerKit, exceptions: [{ rule: "tree/task-name", path: "src/internal/app-binder/task/*.ts", reason: "test" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("0 errors · 0 warnings · 1 exception");
    expect(code).toBe(0);
  });

  it("rejects flags that don't go together, and reads --flag=false", () => {
    expect(guardrails(["--package", KIT, "--affected"]).out).toContain(
      "--affected only works with --repo",
    );
    expect(guardrails(["--repo", "--strict"]).out).toContain(
      "--strict only works on one package",
    );
    expect(guardrails(["--package"]).out).toContain(
      "--package needs a directory",
    );
    expect(guardrails(["--package", KIT, "--strict=nope"]).code).toBe(2);
    expect(guardrails(["--package", KIT, "--repo=false"]).code).toBe(0);
  });

  it("reads the local tsconfig paths when its extends can't be resolved", () => {
    writeFiles(path.join(temp.dir, KIT), {
      "tsconfig.json": JSON.stringify({
        extends: "@ledgerhq/missing-tsconfig/base.json",
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@api/*": ["./src/api/*"],
            "@internal/*": ["./src/internal/*"],
          },
        },
      }),
      "src/internal/app-binder/command/GetAddressCommand.ts":
        'import { SendTask } from "@internal/app-binder/task/SendTask";\nexport class GetAddressCommand { task?: SendTask; }\n',
    });
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("layers/command-is-leaf");
    expect(code).toBe(1);
  });

  it("stops when the tsconfig paths can't be read", () => {
    writeFiles(path.join(temp.dir, KIT), {
      "tsconfig.json": JSON.stringify({
        extends: "@ledgerhq/missing-tsconfig/base.json",
      }),
    });
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain('it has no "paths" of its own');
    expect(code).toBe(2);
  });

  it("--repo --affected also checks the package a file was moved out of", () => {
    const published = (dir, name) => ({
      [`${dir}/package.json`]: JSON.stringify({ name, private: false }),
      [`${dir}/README.md`]: `# ${name}\n`,
      [`${dir}/CHANGELOG.md`]: "# Changelog\n",
    });
    writeFiles(temp.dir, {
      ...published("packages/signer/signer-utils", "@ledgerhq/signer-utils"),
      ...published(
        "packages/device-contacts-kit",
        "@ledgerhq/device-contacts-kit",
      ),
    });
    commitAll(temp.dir);
    git(temp.dir, "switch", "-q", "-c", "feature");
    git(
      temp.dir,
      "mv",
      "packages/signer/signer-utils/README.md",
      "packages/device-contacts-kit/OLD-README.md",
    );
    git(temp.dir, "commit", "-q", "-m", "move");

    const { code, out } = guardrails(["--repo", "--affected"], {
      TURBO_SCM_BASE: "main",
    });
    expect(out).toContain("✖ @ledgerhq/signer-utils");
    expect(out).toContain("README.md is missing");
    expect(code).toBe(1);
  });

  it("lifts deps/edge-allowed for a dependency in package.json and in the files that import it", () => {
    writeFiles(temp.dir, {
      "pnpm-workspace.yaml":
        "packages:\n  - packages/*\n  - packages/signer/*\n  - packages/transport/*\n",
      "packages/transport/web-hid/package.json": JSON.stringify({
        name: "@ledgerhq/device-transport-kit-web-hid",
        private: false,
      }),
      [`${KIT}/package.json`]: JSON.stringify(
        kitManifest({
          dependencies: {
            "@ledgerhq/signer-utils": "workspace:^",
            "@ledgerhq/device-transport-kit-web-hid": "workspace:^",
          },
        }),
      ),
    });
    writeFiles(path.join(temp.dir, KIT), {
      "src/internal/useHid.ts":
        'export { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";\n',
    });
    const before = guardrails(["--package", KIT]);
    expect(before.out).toContain("signerKit → transport is not allowed");
    expect(before.out).toContain("src/internal/useHid.ts");

    setConfig(
      `{ role: signerKit, exceptions: [{ rule: "deps/edge-allowed", path: "package.json#@ledgerhq/device-transport-kit-web-hid", reason: "test" }] }`,
    );
    const { code, out } = guardrails(["--package", KIT]);
    expect(out).toContain("0 errors · 0 warnings · 1 exception");
    expect(code).toBe(0);
  });

  it("--repo requires the exact guardrails script", () => {
    writeFiles(temp.dir, {
      [`${KIT}/package.json`]: JSON.stringify(
        kitManifest({
          scripts: { ...kitManifest().scripts, guardrails: "true" },
        }),
      ),
    });
    const { code, out } = guardrails(["--repo"]);
    expect(out).toContain(
      'the "guardrails" script must be "pnpm ldmk-tool guardrails", not "true"',
    );
    expect(code).toBe(1);
  });

  it("rejects unknown flags and extra arguments", () => {
    const misspelled = guardrails(["--package", KIT, "--stict"]);
    expect(misspelled.out).toContain("unknown argument(s): --stict");
    expect(misspelled.code).toBe(2);
    const positional = guardrails(["--package", KIT, "../signer-xrp"]);
    expect(positional.out).toContain("unknown argument(s): ../signer-xrp");
    expect(positional.code).toBe(2);
  });

  it("checks a package even when another package's config is invalid", () => {
    writeFiles(temp.dir, {
      "packages/signer/signer-bar/package.json": JSON.stringify(
        kitManifest({ name: "@ledgerhq/device-signer-kit-bar" }),
      ),
      "packages/signer/signer-bar/guardrails.config.mjs":
        "export default 42;\n",
    });
    const kit = guardrails(["--package", KIT]);
    expect(kit.out).toContain("0 errors · 0 warnings · 0 exceptions");
    expect(kit.code).toBe(0);

    const repo = guardrails(["--repo"]);
    expect(repo.out).toContain("(role: invalid config)");
    expect(repo.out).toContain("tree/guardrails-config");
    expect(repo.code).toBe(1);

    const broken = guardrails(["--package", "packages/signer/signer-bar"]);
    expect(broken.out).toContain(
      "packages/signer/signer-bar/guardrails.config.mjs is invalid",
    );
    expect(broken.code).toBe(2);
  });

  it("--repo checks the packages without a role, and skips the kit", () => {
    writeFiles(temp.dir, {
      "packages/device-contacts-kit/package.json": JSON.stringify({
        name: "@ledgerhq/device-contacts-kit",
        private: false,
      }),
      "packages/device-contacts-kit/CHANGELOG.md": "# Changelog\n",
    });
    const { code, out } = guardrails(["--repo"]);
    expect(out).toContain("✖ @ledgerhq/device-contacts-kit  (role: generic)");
    expect(out).toContain("README.md is missing");
    expect(out).not.toContain("device-signer-kit-foo");
    expect(code).toBe(1);
  });
});
