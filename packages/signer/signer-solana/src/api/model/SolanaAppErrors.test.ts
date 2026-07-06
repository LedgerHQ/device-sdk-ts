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

  it("should return false for a plain error", () => {
    expect(isSolanaAppError(new Error("boom"))).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isSolanaAppError(undefined)).toBe(false);
    expect(isSolanaAppError(null)).toBe(false);
    expect(isSolanaAppError("6985")).toBe(false);
  });
});
