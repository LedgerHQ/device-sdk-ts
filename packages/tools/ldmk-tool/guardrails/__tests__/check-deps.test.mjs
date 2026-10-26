import { describe, expect, it } from "vitest";

import { checkManifests } from "../check-deps.mjs";
import { generic } from "../index.mjs";
import { DMK, kitManifest, makePackage } from "./fixtures.mjs";

const CM = "@ledgerhq/context-module";
const genericConfig = { role: generic, extraFolders: [], exceptions: [] };

const core = makePackage({
  dir: "packages/device-management-kit",
  manifest: { name: DMK, private: false },
  group: "core",
  config: genericConfig,
});
const contextModule = makePackage({
  dir: "packages/signer/context-module",
  manifest: { name: CM, private: false },
  group: "signerSupport",
  config: genericConfig,
});
const signerUtils = makePackage({
  dir: "packages/signer/signer-utils",
  manifest: { name: "@ledgerhq/signer-utils", private: false },
  group: "signerSupport",
  config: genericConfig,
});

function rulesOf(kit, others = []) {
  const result = checkManifests([
    core,
    contextModule,
    signerUtils,
    ...others,
    kit,
  ]);
  return result.get(kit.dir).map((v) => v.rule);
}

describe("[deps] checkManifests", () => {
  it("passes a well-formed kit", () => {
    expect(rulesOf(makePackage())).toEqual([]);
  });

  describe("deps/group-declared", () => {
    it("fails a package that matches no group", () => {
      const pkg = makePackage({ dir: "packages/somewhere/else", group: null });
      expect(rulesOf(pkg)).toEqual(["deps/group-declared"]);
    });

    it("fails a signer kit without guardrails.config.mjs", () => {
      const pkg = makePackage({ config: genericConfig });
      expect(rulesOf(pkg)).toEqual(["deps/group-declared"]);
    });

    it("fails a role that doesn't match the package path", () => {
      const pkg = makePackage({
        dir: "packages/transport/foo",
        group: "transport",
        manifest: kitManifest({ dependencies: {} }),
      });
      expect(rulesOf(pkg)).toEqual(["deps/group-declared"]);
    });
  });

  describe("deps/core-is-peer", () => {
    it("fails the DMK in dependencies", () => {
      const pkg = makePackage({
        manifest: kitManifest({
          dependencies: { [DMK]: "workspace:^" },
          peerDependencies: {},
        }),
      });
      expect(rulesOf(pkg)).toEqual(["deps/core-is-peer"]);
    });

    it("fails a peer DMK without its devDependencies copy", () => {
      const pkg = makePackage({
        manifest: kitManifest({ devDependencies: {} }),
      });
      expect(rulesOf(pkg)).toEqual(["deps/core-is-peer"]);
    });

    it("lets an app use the DMK as a dependency", () => {
      const app = makePackage({
        dir: "apps/sample",
        manifest: {
          name: "sample",
          private: true,
          dependencies: { [DMK]: "workspace:^" },
        },
        group: "app",
        config: genericConfig,
      });
      expect(rulesOf(app)).toEqual([]);
    });
  });

  describe("deps/no-duplicate-kind", () => {
    it("fails a dependency listed in dependencies and peerDependencies", () => {
      const pkg = makePackage({
        manifest: kitManifest({
          dependencies: { rxjs: "^7" },
          peerDependencies: { [DMK]: "workspace:^", rxjs: "^7" },
        }),
      });
      expect(rulesOf(pkg)).toEqual(["deps/no-duplicate-kind"]);
    });
  });

  describe("deps/context-module-kind", () => {
    it("accepts the runtime form, like signer-solana", () => {
      const pkg = makePackage({
        manifest: kitManifest({ dependencies: { [CM]: "workspace:^" } }),
      });
      expect(rulesOf(pkg)).toEqual([]);
    });

    it("accepts the peer form, like signer-eth", () => {
      const pkg = makePackage({
        manifest: kitManifest({
          peerDependencies: { [DMK]: "workspace:^", [CM]: "workspace:^" },
          devDependencies: { [DMK]: "workspace:^", [CM]: "workspace:^" },
        }),
      });
      expect(rulesOf(pkg)).toEqual([]);
    });

    it("fails a mix of both forms", () => {
      const pkg = makePackage({
        manifest: kitManifest({
          dependencies: { [CM]: "workspace:^" },
          devDependencies: { [DMK]: "workspace:^", [CM]: "workspace:^" },
        }),
      });
      expect(rulesOf(pkg)).toEqual(["deps/context-module-kind"]);
    });
  });

  describe("deps/edge-allowed", () => {
    it("fails a signer kit depending on another signer kit", () => {
      const other = makePackage({
        dir: "packages/signer/signer-bar",
        manifest: kitManifest({ name: "@ledgerhq/device-signer-kit-bar" }),
      });
      const pkg = makePackage({
        manifest: kitManifest({
          dependencies: { "@ledgerhq/device-signer-kit-bar": "workspace:^" },
        }),
      });
      expect(rulesOf(pkg, [other])).toEqual(["deps/edge-allowed"]);
    });

    it("fails a transport depending on a test package other than the mockserver client", () => {
      const controller = makePackage({
        dir: "packages/speculos-device-controller",
        manifest: {
          name: "@ledgerhq/speculos-device-controller",
          private: false,
        },
        group: "testInfra",
        config: genericConfig,
      });
      const pkg = makePackage({
        dir: "packages/transport/foo",
        group: "transport",
        config: {
          role: {
            name: "transport",
            group: "transport",
            kind: "transport",
            tree: {},
          },
          extraFolders: [],
          exceptions: [],
        },
        manifest: kitManifest({
          dependencies: {
            "@ledgerhq/speculos-device-controller": "workspace:^",
          },
        }),
      });
      expect(rulesOf(pkg, [controller])).toEqual(["deps/edge-allowed"]);
    });
  });

  describe("deps/no-public-to-private", () => {
    it("fails a published package depending on a private one", () => {
      const privateUtils = makePackage({
        dir: "packages/signer/signer-utils",
        manifest: { name: "@ledgerhq/signer-utils", private: true },
        group: "signerSupport",
        config: genericConfig,
      });
      const result = checkManifests([core, privateUtils, makePackage()]);
      expect(
        result.get("packages/signer/signer-foo").map((v) => v.rule),
      ).toEqual(["deps/no-public-to-private"]);
    });
  });

  describe("deps/no-cycles", () => {
    it("fails packages that depend on each other", () => {
      const a = makePackage({
        dir: "packages/devtools/a",
        manifest: { name: "a", private: true, dependencies: { b: "1" } },
        group: "devtools",
        config: genericConfig,
      });
      const b = makePackage({
        dir: "packages/devtools/b",
        manifest: { name: "b", private: true, devDependencies: { a: "1" } },
        group: "devtools",
        config: genericConfig,
      });
      const result = checkManifests([a, b]);
      expect(result.get("packages/devtools/a")).toEqual([
        {
          rule: "deps/no-cycles",
          file: "package.json",
          detail:
            "these packages depend on each other: packages/devtools/a, packages/devtools/b",
        },
      ]);
    });
  });
});
