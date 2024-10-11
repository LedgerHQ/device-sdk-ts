import { DerivationPathUtils } from "./DerivationPathUtils";

describe("DerivationPathUtils", () => {
  it("padding should be 0x80000000", () => {
    // GIVEN
    const padding = 0x80000000;

    // WHEN
    const result = DerivationPathUtils.padding;

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
      44 + DerivationPathUtils.padding,
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
      44 + DerivationPathUtils.padding,
      60 + DerivationPathUtils.padding,
      0 + DerivationPathUtils.padding,
      0 + DerivationPathUtils.padding,
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
      44 + DerivationPathUtils.padding,
      60 + DerivationPathUtils.padding,
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
});
