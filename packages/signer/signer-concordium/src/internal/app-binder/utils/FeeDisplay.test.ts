import {
  encodeDisplayFee,
  isAtLeastVersion,
} from "@internal/app-binder/utils/FeeDisplay";

describe("isAtLeastVersion", () => {
  const min = { major: 5, minor: 5, patch: 2 };

  it.each([
    ["5.5.2", true],
    ["5.5.3", true],
    ["5.6.0", true],
    ["6.0.0", true],
    ["10.0.0", true],
    ["5.5.1", false],
    ["5.4.99", false],
    ["4.99.99", false],
    ["0.0.0", false],
  ])("%s >= 5.5.2 → %s", (version, expected) => {
    expect(isAtLeastVersion(version, min)).toBe(expected);
  });

  it("treats missing components as 0", () => {
    expect(isAtLeastVersion("5", min)).toBe(false);
    expect(isAtLeastVersion("5.5", min)).toBe(false);
    expect(isAtLeastVersion("6", min)).toBe(true);
  });

  it("treats non-numeric components as 0", () => {
    expect(isAtLeastVersion("x.y.z", min)).toBe(false);
    expect(isAtLeastVersion("5.5.abc", min)).toBe(false);
  });

  it("defaults to the module's MIN_FEE_DISPLAY_VERSION", () => {
    // No min passed → uses 5.5.2
    expect(isAtLeastVersion("5.5.2")).toBe(true);
    expect(isAtLeastVersion("5.5.1")).toBe(false);
  });
});

describe("encodeDisplayFee", () => {
  it("encodes 0 as 8 zero bytes", () => {
    expect(encodeDisplayFee(0n)).toStrictEqual(new Uint8Array(8));
  });

  it("encodes 1 as 0x00...01 (big-endian)", () => {
    const expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(encodeDisplayFee(1n)).toStrictEqual(expected);
  });

  it("encodes a typical µCCD fee in big-endian", () => {
    // 0x0123456789abcdef
    const fee = 0x0123456789abcdefn;
    const expected = new Uint8Array([
      0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
    ]);
    expect(encodeDisplayFee(fee)).toStrictEqual(expected);
  });

  it("encodes the max u64 (2^64 - 1) as all 0xff", () => {
    const fee = (1n << 64n) - 1n;
    expect(encodeDisplayFee(fee)).toStrictEqual(new Uint8Array(8).fill(0xff));
  });

  it("throws on negative fees", () => {
    expect(() => encodeDisplayFee(-1n)).toThrow(RangeError);
  });

  it("throws on fees exceeding 2^64 - 1", () => {
    expect(() => encodeDisplayFee(1n << 64n)).toThrow(RangeError);
  });
});
