import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkImports } from "../check-imports.mjs";
import { defineGuardrails, transport } from "../index.mjs";
import { listFiles } from "../workspace.mjs";
import {
  goodKitFiles,
  goodTransportFiles,
  makePackage,
  makeTempDir,
  writeFiles,
} from "./fixtures.mjs";

let temp;
afterEach(() => temp?.cleanup());

async function importViolations(files, packageOptions = {}) {
  temp = makeTempDir();
  const absDir = path.join(temp.dir, "signer-foo");
  writeFiles(absDir, files);
  const pkg = makePackage({ absDir, ...packageOptions });
  return checkImports(pkg, listFiles(absDir), new Map());
}

async function importRules(files, packageOptions) {
  return (await importViolations(files, packageOptions)).map((v) => v.rule);
}

describe("[deps] [layers] checkImports, signer kit", () => {
  it("passes the fixture kit, where each layer imports the one below it", async () => {
    expect(await importRules(goodKitFiles())).toEqual([]);
  });

  it("layers/index-only-api: fails src/index.ts exporting something else", async () => {
    const files = goodKitFiles();
    files["src/index.ts"] += 'export * from "@internal/di";\n';
    expect(await importRules(files)).toEqual(["layers/index-only-api"]);
  });

  describe("layers/api-internal-type-only", () => {
    it("fails a value import from internal/", async () => {
      const files = goodKitFiles();
      files["src/api/model/Helpers.ts"] =
        'import { CLA } from "@internal/app-binder/command/utils/constants";\nexport const cla = CLA;\n';
      expect(await importRules(files)).toEqual([
        "layers/api-internal-type-only",
      ]);
    });

    it("accepts an inline type import from internal/", async () => {
      const files = goodKitFiles();
      files["src/api/model/Helpers.ts"] =
        'import { type GetAddressDAOutput } from "@internal/app-binder/device-action/GetAddress/GetAddressDeviceAction.types";\nexport type Out = GetAddressDAOutput;\n';
      expect(await importRules(files)).toEqual([]);
    });
  });

  it("layers/ladder: fails a task importing a use case", async () => {
    const files = goodKitFiles();
    files["src/internal/app-binder/task/OtherTask.ts"] =
      'import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";\nexport const x = GetAddressUseCase;\n';
    expect(await importRules(files)).toEqual(["layers/ladder"]);
  });

  it("layers/command-is-leaf: fails a command importing a task, even as a type", async () => {
    const files = goodKitFiles();
    files["src/internal/app-binder/task/TaskArgs.ts"] =
      "export type TaskArgs = { a: 1 };\n";
    files["src/internal/app-binder/command/SignCommand.ts"] =
      'import { type TaskArgs } from "@internal/app-binder/task/TaskArgs";\nexport class SignCommand { args?: TaskArgs; }\n';
    const violations = await importViolations(files);
    expect(violations.map((v) => v.rule)).toEqual(["layers/command-is-leaf"]);
    expect(violations[0]).toMatchObject({
      file: "src/internal/app-binder/command/SignCommand.ts",
      line: 1,
    });
  });

  it("layers/command-no-command: fails a command importing another command", async () => {
    const files = goodKitFiles();
    files["src/internal/app-binder/command/SignCommand.ts"] =
      'import { GetAddressCommand } from "./GetAddressCommand";\nexport class SignCommand { c = GetAddressCommand; }\n';
    expect(await importRules(files)).toEqual(["layers/command-no-command"]);
  });

  describe("layers/no-circular", () => {
    it("fails a runtime cycle", async () => {
      const files = goodKitFiles();
      files["src/internal/shared/utils/a.ts"] =
        'import { b } from "./b";\nexport const a = () => b;\n';
      files["src/internal/shared/utils/b.ts"] =
        'import { a } from "./a";\nexport const b = () => a;\n';
      expect(await importRules(files)).toEqual(["layers/no-circular"]);
    });

    it("ignores a cycle that goes through a type-only import", async () => {
      const files = goodKitFiles();
      files["src/internal/shared/utils/a.ts"] =
        'import { type B } from "./b";\nexport type A = { b?: B };\n';
      files["src/internal/shared/utils/b.ts"] =
        'import { type A } from "./a";\nexport type B = { a?: A };\n';
      expect(await importRules(files)).toEqual([]);
    });
  });

  it("deps/declared: fails an import of an undeclared @ledgerhq package", async () => {
    const files = goodKitFiles();
    files["src/internal/shared/utils/x.ts"] =
      'import { thing } from "@ledgerhq/undeclared";\nexport const x = thing;\n';
    expect(await importRules(files)).toEqual(["deps/declared"]);
  });

  it("deps/no-deep: fails a deep import of another package", async () => {
    const files = goodKitFiles();
    files["src/internal/shared/utils/x.ts"] =
      'import { thing } from "@ledgerhq/signer-utils/lib/esm/thing";\nexport const x = thing;\n';
    expect(await importRules(files)).toEqual(["deps/no-deep"]);
  });

  it("deps/edge-allowed: fails production code importing a dev-only group", async () => {
    const files = goodKitFiles();
    files["src/internal/shared/utils/x.ts"] =
      'import { thing } from "@ledgerhq/ldmk-tool";\nexport const x = thing;\n';
    temp = makeTempDir();
    const absDir = path.join(temp.dir, "signer-foo");
    writeFiles(absDir, files);
    const pkg = makePackage({ absDir });
    pkg.manifest.devDependencies["@ledgerhq/ldmk-tool"] = "workspace:^";
    const tool = makePackage({
      dir: "packages/tools/ldmk-tool",
      manifest: { name: "@ledgerhq/ldmk-tool", private: true },
      group: "tooling",
    });
    const violations = await checkImports(
      pkg,
      listFiles(absDir),
      new Map([[tool.name, tool]]),
    );
    expect(violations.map((v) => v.rule)).toEqual(["deps/edge-allowed"]);
  });
});

describe("[layers] checkImports, transport", () => {
  const options = {
    dir: "packages/transport/foo",
    group: "transport",
    config: defineGuardrails({ role: transport.webFamily }),
  };

  it("passes the fixture transport", async () => {
    expect(await importRules(goodTransportFiles(), options)).toEqual([]);
  });

  it("layers/internal-not-exported: fails src/index.ts exporting src/internal/", async () => {
    const files = goodTransportFiles();
    files["src/internal/Datasource.ts"] = "export class Datasource {}\n";
    files["src/index.ts"] +=
      'export { Datasource } from "./internal/Datasource";\n';
    expect(await importRules(files, options)).toEqual([
      "layers/internal-not-exported",
    ]);
  });
});
