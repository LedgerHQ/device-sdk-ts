import { describe, expect, it } from "vitest";

import { checkGenericPackageFiles, checkTree } from "../check-tree.mjs";
import { defineGuardrails, generic, signerKit, transport } from "../index.mjs";
import {
  goodKitFiles,
  goodTransportFiles,
  kitManifest,
  makePackage,
} from "./fixtures.mjs";

const kitFiles = () => ["package.json", ...Object.keys(goodKitFiles())];

function treeRules(
  files,
  config = defineGuardrails({ role: signerKit }),
  manifest,
) {
  const pkg = makePackage({ config, manifest });
  return checkTree(pkg, [...files].sort()).found.map((v) => v.rule);
}

describe("[tree] checkTree, signer kit", () => {
  it("passes the fixture kit", () => {
    expect(treeRules(kitFiles())).toEqual([]);
  });

  describe("tree/required", () => {
    it("fails a missing DefaultSigner<X>", () => {
      const files = kitFiles().filter(
        (f) => f !== "src/internal/DefaultSignerFoo.ts",
      );
      expect(treeRules(files)).toEqual(["tree/required"]);
    });

    it("fails two AppBinders", () => {
      expect(
        treeRules([...kitFiles(), "src/internal/app-binder/BarAppBinder.ts"]),
      ).toEqual(["tree/required"]);
    });
  });

  describe("tree/allowed-folders", () => {
    it("fails an unknown folder", () => {
      expect(
        treeRules([...kitFiles(), "src/internal/app-binder/magic/Thing.ts"]),
      ).toEqual(["tree/allowed-folders"]);
    });

    it("accepts a folder listed in extraFolders", () => {
      const config = defineGuardrails({
        role: signerKit,
        extraFolders: [
          { path: "src/internal/app-binder/magic", reason: "test" },
        ],
      });
      const pkg = makePackage({ config });
      const { found, usedExtraFolders } = checkTree(pkg, [
        ...kitFiles(),
        "src/internal/app-binder/magic/Thing.ts",
      ]);
      expect(found).toEqual([]);
      expect([...usedExtraFolders]).toEqual(["src/internal/app-binder/magic"]);
    });

    it("accepts feature folders in the featureFolders variant, and checks their content", () => {
      const config = defineGuardrails({ role: signerKit.featureFolders });
      const files = [
        ...kitFiles().filter((f) => !f.startsWith("src/internal/use-cases/")),
        "src/internal/address/use-case/GetAddressUseCase.ts",
        "src/internal/address/di/addressModule.ts",
      ];
      expect(treeRules(files, config)).toEqual([]);
      expect(
        treeRules([...files, "src/internal/address/helpers/x.ts"], config),
      ).toEqual(["tree/allowed-folders"]);
    });
  });

  it("tree/command-name: fails a command file without the Command suffix", () => {
    expect(
      treeRules([
        ...kitFiles(),
        "src/internal/app-binder/command/GetAddress.ts",
      ]),
    ).toEqual(["tree/command-name"]);
  });

  it("tree/task-name: fails a task file without the Task suffix", () => {
    expect(
      treeRules([...kitFiles(), "src/internal/app-binder/task/Helpers.ts"]),
    ).toEqual(["tree/task-name"]);
  });

  it("tree/device-action-location: fails a device action outside its folder", () => {
    expect(
      treeRules([
        ...kitFiles(),
        "src/internal/app-binder/device-action/SignDeviceAction.ts",
      ]),
    ).toEqual(["tree/device-action-location"]);
  });

  it("tree/file-case: fails a kebab-case file, but not a test fixture", () => {
    expect(
      treeRules([...kitFiles(), "src/internal/shared/utils/hex-utils.ts"]),
    ).toEqual(["tree/file-case"]);
    expect(
      treeRules([
        ...kitFiles(),
        "src/internal/shared/__fixtures__/logs-2026-05-11.ts",
      ]),
    ).toEqual([]);
  });

  it("tree/folder-case: fails a PascalCase folder outside device-action/", () => {
    expect(
      treeRules([...kitFiles(), "src/internal/shared/Helpers/hex.ts"]),
    ).toEqual(["tree/folder-case"]);
  });

  describe("tree/package-files", () => {
    it("fails a missing CHANGELOG on a published package", () => {
      expect(treeRules(kitFiles().filter((f) => f !== "CHANGELOG.md"))).toEqual(
        ["tree/package-files"],
      );
    });

    it("fails a missing guardrails script", () => {
      const manifest = kitManifest();
      delete manifest.scripts.guardrails;
      expect(treeRules(kitFiles(), undefined, manifest)).toEqual([
        "tree/package-files",
      ]);
    });

    it("fails generic published packages without README", () => {
      const pkg = makePackage({
        config: { role: generic, extraFolders: [], exceptions: [] },
      });
      expect(
        checkGenericPackageFiles(pkg, ["CHANGELOG.md"]).map((v) => v.detail),
      ).toEqual(["README.md is missing"]);
    });
  });
});

describe("[tree] checkTree, transport", () => {
  const files = () =>
    ["package.json", ...Object.keys(goodTransportFiles())].sort();
  const run = (
    list,
    config = defineGuardrails({ role: transport.webFamily }),
  ) =>
    checkTree(
      makePackage({
        dir: "packages/transport/foo",
        group: "transport",
        config,
      }),
      list,
    ).found.map((v) => v.rule);

  it("passes the fixture transport", () => {
    expect(run(files())).toEqual([]);
  });

  it("tree/required: fails a web-family transport without its ApduSender", () => {
    expect(run(files().filter((f) => !f.endsWith("ApduSender.ts")))).toEqual([
      "tree/required",
    ]);
  });

  it("tree/required: the base variant only needs one *Transport.ts", () => {
    const base = defineGuardrails({ role: transport });
    expect(
      run(
        [
          "src/index.ts",
          "src/FooTransport.ts",
          ...files().filter((f) => !f.startsWith("src/")),
        ],
        base,
      ),
    ).toEqual([]);
    expect(
      run([...files(), "src/api/transport/OtherTransport.ts"], base),
    ).toEqual(["tree/required"]);
  });

  it("tree/allowed-folders: fails an unknown folder in src/api/", () => {
    expect(run([...files(), "src/api/helpers/x.ts"])).toEqual([
      "tree/allowed-folders",
    ]);
  });
});
