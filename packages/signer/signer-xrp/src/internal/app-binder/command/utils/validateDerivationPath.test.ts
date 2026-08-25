import {
  DerivationPathTooLongError,
  MAX_DERIVATION_PATH_LENGTH,
  validateDerivationPath,
} from "./validateDerivationPath";

describe("validateDerivationPath", () => {
  it("should split a path into its elements, hardening with 0x80000000", () => {
    // WHEN
    const path = validateDerivationPath("44'/144'/0'/0/0");

    // THEN
    expect(path).toStrictEqual([
      0x8000002c, 0x80000090, 0x80000000, 0x00000000, 0x00000000,
    ]);
  });

  it("should accept a path of exactly the maximum length", () => {
    // GIVEN
    const derivationPath = Array(MAX_DERIVATION_PATH_LENGTH)
      .fill("0")
      .join("/");

    // WHEN
    const path = validateDerivationPath(derivationPath);

    // THEN
    expect(path).toHaveLength(MAX_DERIVATION_PATH_LENGTH);
  });

  it("should reject a path longer than the maximum length", () => {
    // GIVEN
    const derivationPath = Array(MAX_DERIVATION_PATH_LENGTH + 1)
      .fill("0")
      .join("/");

    // WHEN / THEN
    expect(() => validateDerivationPath(derivationPath)).toThrow(
      DerivationPathTooLongError,
    );
    expect(() => validateDerivationPath(derivationPath)).toThrow(
      `Derivation path has 11 elements, the XRP app accepts at most 10`,
    );
  });

  it("should propagate the split error for a malformed path", () => {
    // WHEN / THEN
    expect(() => validateDerivationPath("44'/not-a-number")).toThrow(
      "invalid number provided",
    );
  });
});
