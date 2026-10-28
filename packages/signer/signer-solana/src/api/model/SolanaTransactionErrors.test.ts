import {
  InvalidSolanaTransactionError,
  isInvalidSolanaTransactionError,
  isSolanaTransactionVersionNotSupportedError,
  SolanaTransactionVersionNotSupportedError,
} from "./SolanaTransactionErrors";

describe("SolanaTransactionVersionNotSupportedError", () => {
  it("names the version for an unknown version", () => {
    const error = new SolanaTransactionVersionNotSupportedError(
      2,
      "unknownVersion",
    );

    expect(error).toMatchObject({
      _tag: "SolanaTransactionVersionNotSupportedError",
      version: 2,
      reason: "unknownVersion",
    });
    expect(error.originalError.message).toBe(
      "Solana transaction version 2 is not supported.",
    );
  });

  it("asks for an app update when the app is too old", () => {
    const error = new SolanaTransactionVersionNotSupportedError(
      1,
      "appVersion",
    );

    expect(error.originalError.message).toBe(
      "Solana transaction version 1 is not supported by this Solana app version. Update the Solana app.",
    );
  });
});

describe("InvalidSolanaTransactionError", () => {
  it("names the rule and its detail", () => {
    const error = new InvalidSolanaTransactionError(
      "CONFIG_MASK",
      "Unknown config bits in mask 0x2f.",
    );

    expect(error).toMatchObject({
      _tag: "InvalidSolanaTransactionError",
      rule: "CONFIG_MASK",
    });
    expect(error.originalError.message).toBe(
      "Invalid Solana v1 transaction (CONFIG_MASK): Unknown config bits in mask 0x2f.",
    );
  });
});

describe("isSolanaTransactionVersionNotSupportedError", () => {
  it("accepts the error and a structurally equal object from another copy of the kit", () => {
    expect(
      isSolanaTransactionVersionNotSupportedError(
        new SolanaTransactionVersionNotSupportedError(2, "unknownVersion"),
      ),
    ).toBe(true);
    expect(
      isSolanaTransactionVersionNotSupportedError({
        _tag: "SolanaTransactionVersionNotSupportedError",
        version: 1,
      }),
    ).toBe(true);
  });

  it.each([
    ["the other error", new InvalidSolanaTransactionError("VERSION", "x")],
    [
      "a missing version",
      { _tag: "SolanaTransactionVersionNotSupportedError" },
    ],
    ["a plain error", new Error("boom")],
    ["null", null],
    ["a string", "SolanaTransactionVersionNotSupportedError"],
  ])("rejects %s", (_, value) => {
    expect(isSolanaTransactionVersionNotSupportedError(value)).toBe(false);
  });
});

describe("isInvalidSolanaTransactionError", () => {
  it("accepts the error and a structurally equal object from another copy of the kit", () => {
    expect(
      isInvalidSolanaTransactionError(
        new InvalidSolanaTransactionError("TRAILING_BYTES", "x"),
      ),
    ).toBe(true);
    expect(
      isInvalidSolanaTransactionError({
        _tag: "InvalidSolanaTransactionError",
        rule: "TRUNCATED",
      }),
    ).toBe(true);
  });

  it.each([
    [
      "the other error",
      new SolanaTransactionVersionNotSupportedError(1, "appVersion"),
    ],
    ["a missing rule", { _tag: "InvalidSolanaTransactionError" }],
    ["a plain error", new Error("boom")],
    ["undefined", undefined],
  ])("rejects %s", (_, value) => {
    expect(isInvalidSolanaTransactionError(value)).toBe(false);
  });
});
