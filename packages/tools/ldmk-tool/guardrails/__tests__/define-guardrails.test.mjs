import { describe, expect, it } from "vitest";

import { defineGuardrails, signerKit, transport } from "../index.mjs";

describe("defineGuardrails", () => {
  it("accepts a role and its variants", () => {
    expect(defineGuardrails({ role: signerKit }).role.name).toBe("signerKit");
    expect(defineGuardrails({ role: signerKit.featureFolders }).role.name).toBe(
      "signerKit.featureFolders",
    );
    expect(defineGuardrails({ role: transport.webFamily }).role.name).toBe(
      "transport.webFamily",
    );
  });

  it("rejects a missing role", () => {
    expect(() => defineGuardrails({})).toThrow(/"role" must be one of/);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      defineGuardrails({ role: signerKit, allowedFolders: [] }),
    ).toThrow(/unknown field "allowedFolders"/);
  });

  it("rejects extraFolders on a role that doesn't list its folders", () => {
    expect(() =>
      defineGuardrails({
        role: transport,
        extraFolders: [{ path: "src/foo", reason: "test" }],
      }),
    ).toThrow(/"extraFolders" needs a role that lists its folders/);
  });

  it("rejects wildcards in [deps] and [layers] exceptions, not in [tree] ones", () => {
    const withException = (rule, path) =>
      defineGuardrails({
        role: signerKit,
        exceptions: [{ rule, path, reason: "test" }],
      });
    expect(() => withException("layers/ladder", "**")).toThrow(
      /without wildcards/,
    );
    expect(() => withException("deps/edge-allowed", "package.json#*")).toThrow(
      /without wildcards/,
    );
    expect(() =>
      withException("tree/task-name", "src/internal/app-binder/task/*.ts"),
    ).not.toThrow();
    expect(() =>
      withException("deps/edge-allowed", "package.json#@ledgerhq/x"),
    ).not.toThrow();
  });

  it("rejects exceptions for the rules that decide whether a package is checked", () => {
    for (const rule of ["deps/group-declared", "tree/guardrails-script"]) {
      expect(() =>
        defineGuardrails({
          role: signerKit,
          exceptions: [{ rule, path: "package.json", reason: "test" }],
        }),
      ).toThrow(/can't be excepted/);
    }
  });

  it("requires a reason for every extra folder and exception", () => {
    expect(() =>
      defineGuardrails({
        role: signerKit,
        extraFolders: [{ path: "src/internal/x" }],
      }),
    ).toThrow(/extraFolders\[0\] needs a "reason"/);
    expect(() =>
      defineGuardrails({
        role: signerKit,
        exceptions: [{ rule: "tree/task-name", path: "src/x.ts", reason: " " }],
      }),
    ).toThrow(/exceptions\[0\] needs a "reason"/);
  });

  it("rejects an exception for an unknown rule", () => {
    expect(() =>
      defineGuardrails({
        role: signerKit,
        exceptions: [
          { rule: "tree/nope", path: "src/x.ts", reason: "because" },
        ],
      }),
    ).toThrow(/unknown rule "tree\/nope"/);
  });
});
