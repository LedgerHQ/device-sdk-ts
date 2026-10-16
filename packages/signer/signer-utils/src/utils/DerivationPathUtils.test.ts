import { DerivationPathUtils } from "./DerivationPathUtils";

describe("DerivationPathUtils", () => {
  it("padding should be 0x80000000", () => {
    // GIVEN
    const padding = 0x80000000;

    // WHEN
    const result = DerivationPathUtils.PADDING;

    // THEN
    expect(result).toBe(padding);
  });

  it("should split the derivation path", () => {
    // GIVEN
    const path = "44'/60/0/0/0";

    // WHEN
    const result = DerivationPathUtils.splitPath(path);

    // THEN
    expect(result).toStrictEqual([
      44 + DerivationPathUtils.PADDING,
      60,
      0,
      0,
      0,
    ]);
  });

  it("should split the derivation path with hardened path", () => {
    // GIVEN
    const path = "44'/60'/0'/0'/1";

    // WHEN
    const result = DerivationPathUtils.splitPath(path);

    // THEN
    expect(result).toStrictEqual([
      44 + DerivationPathUtils.PADDING,
      60 + DerivationPathUtils.PADDING,
      0 + DerivationPathUtils.PADDING,
      0 + DerivationPathUtils.PADDING,
      1,
    ]);
  });

  it("should split the derivation path with custom path", () => {
    // GIVEN
    const path = "44'/60'/5/4/3";

    // WHEN
    const result = DerivationPathUtils.splitPath(path);

    // THEN
    expect(result).toStrictEqual([
      44 + DerivationPathUtils.PADDING,
      60 + DerivationPathUtils.PADDING,
      5,
      4,
      3,
    ]);
  });

  it("should throw an error if invalid number provided", () => {
    // GIVEN
    const path = "44'/60'/zzz/4/3";

    // WHEN
    const result = () => DerivationPathUtils.splitPath(path);

    // THEN
    expect(result).toThrow(new Error("invalid number provided"));
  });

  it("should reject parseInt prefix truncation", () => {
    expect(() => DerivationPathUtils.splitPath("44'/60'/0'/0/12abc")).toThrow(
      new Error("invalid number provided"),
    );
    expect(() => DerivationPathUtils.splitPath("44'/60'/0'/0/12abc'")).toThrow(
      new Error("invalid number provided"),
    );
  });

  it("should reject a harden-bit overflow index", () => {
    expect(() => DerivationPathUtils.splitPath("2147483648")).toThrow(
      new Error("BIP32 index out of range"),
    );
    expect(() => DerivationPathUtils.splitPath("2147483648'")).toThrow(
      new Error("BIP32 index out of range"),
    );
    expect(() =>
      DerivationPathUtils.splitPath("44'/60'/0'/0/2147483648'"),
    ).toThrow(new Error("BIP32 index out of range"));
  });

  it("should accept the maximum valid BIP32 index", () => {
    expect(DerivationPathUtils.splitPath("2147483647")).toStrictEqual([
      DerivationPathUtils.MAX_INDEX,
    ]);
    expect(DerivationPathUtils.splitPath("2147483647'")).toStrictEqual([
      DerivationPathUtils.MAX_INDEX + DerivationPathUtils.PADDING,
    ]);
  });
});
