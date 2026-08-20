/**
 * Port of `~/dev/ledger-contacts-playground/tests/test_validation.py`.
 * Each test mirrors a rule the firmware enforces, with at least one
 * boundary case to catch off-by-one regressions when SDK constants
 * are bumped. Drift from the SDK headers is caught upstream by the
 * playground's `tests/test_upstream_pins.py`.
 */
import {
  ACCOUNT_NAME_BUFFER_LENGTH,
  CONTACT_NAME_BUFFER_LENGTH,
  MAX_BIP32_DEPTH,
  SCOPE_BUFFER_LENGTH,
  validateAddressHex,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
  ValidationError,
} from "./validation";

describe("validatePrintableLabel", () => {
  it("rejects empty", () => {
    expect(() =>
      validatePrintableLabel("", { field: "name", bufferLength: 33 }),
    ).toThrow(/must not be empty/);
  });

  it("accepts max length (32 bytes)", () => {
    expect(() =>
      validatePrintableLabel("x".repeat(32), {
        field: "name",
        bufferLength: 33,
      }),
    ).not.toThrow();
  });

  it("rejects one over max (33 bytes)", () => {
    expect(() =>
      validatePrintableLabel("x".repeat(33), {
        field: "name",
        bufferLength: 33,
      }),
    ).toThrow(/too long: 33 bytes/);
  });

  it("uses byte count, not codepoint count, for UTF-8", () => {
    // 17 codepoints of `ô` = 34 UTF-8 bytes, over the 32-byte limit
    expect(() =>
      validatePrintableLabel("ô".repeat(17), {
        field: "name",
        bufferLength: 33,
      }),
    ).toThrow(/too long: 34 bytes/);
  });

  it.each([
    "Alice",
    "alice 1",
    "Eth main",
    "a".repeat(32),
    " ".repeat(32), // 0x20 — boundary low
    "~".repeat(32), // 0x7E — boundary high
    "!@#$%^&*()_+-=[]{}|;:,.<>?/",
  ])("accepts ASCII printable: %j", (value) => {
    expect(() =>
      validatePrintableLabel(value, { field: "name", bufferLength: 33 }),
    ).not.toThrow();
  });

  it.each([
    ["ô", "0xc3"], // UTF-8 leading byte
    ["Aliçe", "0xc3"],
    ["\x1fname", "0x1f"], // just below printable
    ["name\x7f", "0x7f"], // DEL — just above printable
    ["name\nwith\nnewlines", "0x0a"],
    ["name\twith\ttabs", "0x09"],
    ["Alice\x00", "0x00"],
    ["emoji 🎉 here", "0xf0"],
  ])("rejects non-ASCII: %j (offending byte %s)", (value, expectedByteHex) => {
    expect(() =>
      validatePrintableLabel(value, { field: "name", bufferLength: 33 }),
    ).toThrow(new RegExp(`non-ASCII.*${expectedByteHex}`, "s"));
  });

  it("treats 0x20 and 0x7E as inclusive boundaries", () => {
    expect(() =>
      validatePrintableLabel("\x20", { field: "x", bufferLength: 33 }),
    ).not.toThrow();
    expect(() =>
      validatePrintableLabel("\x7e", { field: "x", bufferLength: 33 }),
    ).not.toThrow();
    expect(() =>
      validatePrintableLabel("\x1f", { field: "x", bufferLength: 33 }),
    ).toThrow(/non-ASCII/);
    expect(() =>
      validatePrintableLabel("\x7f", { field: "x", bufferLength: 33 }),
    ).toThrow(/non-ASCII/);
  });

  it("buffer-length constants match SDK", () => {
    expect(CONTACT_NAME_BUFFER_LENGTH).toBe(33);
    expect(SCOPE_BUFFER_LENGTH).toBe(33);
    expect(ACCOUNT_NAME_BUFFER_LENGTH).toBe(33);
  });

  it("throws ValidationError instances", () => {
    expect(() =>
      validatePrintableLabel("", { field: "name", bufferLength: 33 }),
    ).toThrow(ValidationError);
  });
});

describe("validateDerivationPath", () => {
  it.each([
    "m/44'/60'/0'/0/0",
    "m/44'",
    "m/0",
    "44'/60'/0'/0/0", // leading 'm' optional
    `m/${Array.from({ length: MAX_BIP32_DEPTH }, () => "0").join("/")}`,
  ])("accepts valid path: %s", (path) => {
    expect(() => validateDerivationPath(path)).not.toThrow();
  });

  it("rejects empty", () => {
    expect(() => validateDerivationPath("")).toThrow(/must not be empty/);
  });

  it("rejects just 'm'", () => {
    expect(() => validateDerivationPath("m")).toThrow(/no segments/);
  });

  it("rejects depth > MAX_BIP32_DEPTH", () => {
    const deep = `m/${Array.from(
      { length: MAX_BIP32_DEPTH + 1 },
      () => "0",
    ).join("/")}`;
    expect(() => validateDerivationPath(deep)).toThrow(
      new RegExp(`max ${MAX_BIP32_DEPTH}`),
    );
  });

  it.each([
    "m/44'/x", // garbage segment
    "m/44'/60'/abc/0", // non-numeric
    "m/44'//0", // empty middle
    "m/44'/60'/0'/0/'", // apostrophe-only segment
  ])("rejects garbage segment: %s", (path) => {
    expect(() => validateDerivationPath(path)).toThrow(ValidationError);
  });

  it("rejects literal 2^31 (must use ' suffix)", () => {
    expect(() => validateDerivationPath("m/2147483648")).toThrow(/2\^31/);
  });
});

describe("validateAddressHex", () => {
  it("accepts canonical 20-byte address", () => {
    expect(() => validateAddressHex(`0x${"ab".repeat(20)}`)).not.toThrow();
    expect(() => validateAddressHex("ab".repeat(20))).not.toThrow();
    expect(() => validateAddressHex("AB".repeat(20))).not.toThrow();
  });

  it("rejects empty", () => {
    expect(() => validateAddressHex("")).toThrow(/must not be empty/);
  });

  it("rejects bare prefix", () => {
    expect(() => validateAddressHex("0x")).toThrow(/no hex digits after/);
  });

  it("rejects 19 bytes", () => {
    expect(() => validateAddressHex("ab".repeat(19))).toThrow(/is 19 bytes/);
  });

  it("rejects 21 bytes", () => {
    expect(() => validateAddressHex("ab".repeat(21))).toThrow(/is 21 bytes/);
  });

  it("rejects odd hex length", () => {
    expect(() => validateAddressHex("ab".repeat(19) + "a")).toThrow(
      /odd number/,
    );
  });

  it("rejects non-hex characters", () => {
    expect(() => validateAddressHex("zz".repeat(20))).toThrow(/not valid hex/);
  });
});

describe("validateChainId", () => {
  it.each([1, 137, 42161, 10, 8453, 11155111])("accepts %i", (value) => {
    expect(() => validateChainId(value)).not.toThrow();
  });

  it("accepts 2^64 - 1 (max uint64) as bigint", () => {
    expect(() => validateChainId((1n << 64n) - 1n)).not.toThrow();
  });

  it("rejects zero", () => {
    expect(() => validateChainId(0)).toThrow(/positive/);
  });

  it("rejects negative", () => {
    expect(() => validateChainId(-1)).toThrow(/positive/);
  });

  it("rejects 2^64 overflow", () => {
    expect(() => validateChainId(1n << 64n)).toThrow(/uint64/);
  });

  it("rejects non-integer numbers", () => {
    expect(() => validateChainId(1.5)).toThrow(/integer/);
  });
});
