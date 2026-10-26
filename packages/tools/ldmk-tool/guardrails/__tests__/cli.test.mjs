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
  const result = spawnSync(process.execPath, [CLI, "guardrails", ...args], {
    cwd: temp.dir,
    encoding: "utf8",
    env: { ...baseEnv, ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
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
    expect(out).toContain("--strict");
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

  it("--repo --affected only reports the packages changed against TURBO_SCM_BASE", () => {
    const generic = (name) => ({
      [`packages/${name}/package.json`]: JSON.stringify({
        name: `@ledgerhq/${name}`,
        private: false,
      }),
      [`packages/${name}/CHANGELOG.md`]: "# Changelog\n",
    });
    writeFiles(temp.dir, { ...generic("touched"), ...generic("untouched") });
    const git = (...args) =>
      spawnSync(
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
        { cwd: temp.dir, encoding: "utf8" },
      );
    git("init", "-q", "-b", "main");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("switch", "-q", "-c", "feature");
    writeFiles(temp.dir, { "packages/touched/index.js": "export {};\n" });

    const { code, out } = guardrails(["--repo", "--affected"], {
      TURBO_SCM_BASE: "main",
    });
    expect(out).toContain("✖ @ledgerhq/touched");
    expect(out).not.toContain("@ledgerhq/untouched");
    expect(code).toBe(1);
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
