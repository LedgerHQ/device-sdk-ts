import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { isSolanaAppError } from "./SolanaAppErrors";

describe("isSolanaAppError", () => {
  it("should return true for a SolanaAppCommandError", () => {
    const error = new SolanaAppCommandError({
      message: "Canceled by user",
      errorCode: "6985",
    });

    expect(isSolanaAppError(error)).toBe(true);
  });

  it("should return true for a structurally-equivalent error from another class instance (dual-package safe)", () => {
    // Simulates an error minted by a different copy/format (ESM vs CJS) of the
    // kit: same structural contract, different class identity. A structural
    // guard must still recognize it, whereas `instanceof` would not.
    const foreignError = {
      _tag: "SolanaAppCommandError",
      errorCode: "6985",
      message: "Canceled by user",
    };

    expect(isSolanaAppError(foreignError)).toBe(true);
  });

  it("should return false for a plain error", () => {
    expect(isSolanaAppError(new Error("boom"))).toBe(false);
  });

  it("should return false for an object with a different _tag", () => {
    expect(
      isSolanaAppError({ _tag: "SomeOtherError", errorCode: "6985" }),
    ).toBe(false);
  });

  it("should return false when errorCode is missing", () => {
    expect(isSolanaAppError({ _tag: "SolanaAppCommandError" })).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isSolanaAppError(undefined)).toBe(false);
    expect(isSolanaAppError(null)).toBe(false);
    expect(isSolanaAppError("6985")).toBe(false);
  });
});
