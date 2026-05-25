import { describe, expect, it } from "vitest";

import { encodeSuiDerivationPath } from "./SuiDerivationPathUtils";

describe("encodeSuiDerivationPath", () => {
  it("should encode standard Sui BIP44 path as little-endian u32", () => {
    const result = encodeSuiDerivationPath("44'/784'/0'/0'/0'");

    // 5 components
    expect(result[0]).toBe(5);
    expect(result.length).toBe(1 + 5 * 4); // count + 5 x 4 bytes

    const view = new DataView(result.buffer, result.byteOffset);

    // 44' = 44 + 0x80000000 = 0x8000002C
    expect(view.getUint32(1, true)).toBe(0x8000002c);
    // 784' = 784 + 0x80000000 = 0x80000310
    expect(view.getUint32(5, true)).toBe(0x80000310);
    // 0' = 0x80000000
    expect(view.getUint32(9, true)).toBe(0x80000000);
    expect(view.getUint32(13, true)).toBe(0x80000000);
    expect(view.getUint32(17, true)).toBe(0x80000000);
  });

  it("should encode little-endian bytes correctly", () => {
    const result = encodeSuiDerivationPath("44'/784'/0'/0'/0'");

    // 44' = 0x8000002C in LE = [0x2C, 0x00, 0x00, 0x80]
    expect(result[1]).toBe(0x2c);
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0x00);
    expect(result[4]).toBe(0x80);

    // 784' = 0x80000310 in LE = [0x10, 0x03, 0x00, 0x80]
    expect(result[5]).toBe(0x10);
    expect(result[6]).toBe(0x03);
    expect(result[7]).toBe(0x00);
    expect(result[8]).toBe(0x80);
  });

  it("should handle non-hardened components", () => {
    const result = encodeSuiDerivationPath("44'/784'/0'/0'/1");

    const view = new DataView(result.buffer, result.byteOffset);
    // Last component: 1 (not hardened)
    expect(view.getUint32(17, true)).toBe(1);
  });

  it("should handle path with m/ prefix", () => {
    const result = encodeSuiDerivationPath("m/44'/784'/0'/0'/0'");
    expect(result[0]).toBe(5);
  });

  it("should throw for invalid path component", () => {
    expect(() => encodeSuiDerivationPath("abc/def")).toThrow(
      "Invalid path component",
    );
  });
});
