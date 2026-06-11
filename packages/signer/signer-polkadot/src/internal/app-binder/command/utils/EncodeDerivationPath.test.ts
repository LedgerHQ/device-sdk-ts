import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { describe, expect, it } from "vitest";

import { encodeDerivationPath } from "./EncodeDerivationPath";

describe("encodeDerivationPath", () => {
  describe("Given a 5-level Bittensor derivation path (44'/1005'/0'/0'/0')", () => {
    it("should return a 20-byte Uint8Array", () => {
      // ARRANGE
      const paths = DerivationPathUtils.splitPath("44'/1005'/0'/0'/0'");
      // ACT
      const result = encodeDerivationPath(paths);
      // ASSERT
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(20);
    });

    it("should encode each element as little-endian uint32 with hardened flag preserved", () => {
      // ARRANGE
      // 44' = 0x80000000 | 44 = 0x8000002C
      // 1005' = 0x80000000 | 1005 = 0x800003ED
      // 0' = 0x80000000 | 0 = 0x80000000 (three times)
      const paths = DerivationPathUtils.splitPath("44'/1005'/0'/0'/0'");
      // ACT
      const result = encodeDerivationPath(paths);
      // ASSERT
      const expected = new Uint8Array([
        0x2c,
        0x00,
        0x00,
        0x80, // 44' = 0x8000002C LE
        0xed,
        0x03,
        0x00,
        0x80, // 1005' = 0x800003ED LE
        0x00,
        0x00,
        0x00,
        0x80, // 0' = 0x80000000 LE
        0x00,
        0x00,
        0x00,
        0x80, // 0' = 0x80000000 LE
        0x00,
        0x00,
        0x00,
        0x80, // 0' = 0x80000000 LE
      ]);
      expect(result).toStrictEqual(expected);
    });

    it("should preserve the hardened flag for all elements without stripping and re-applying", () => {
      // ARRANGE
      const paths = DerivationPathUtils.splitPath("44'/1005'/0'/0'/0'");
      // ACT
      const result = encodeDerivationPath(paths);
      const dataView = new DataView(result.buffer);
      // ASSERT — all 5 elements must have bit 31 set
      for (let i = 0; i < 5; i++) {
        expect(dataView.getUint32(i * 4, true) >>> 31).toBe(1);
      }
    });

    it("should encode elements as little-endian (first byte is LSB)", () => {
      // ARRANGE
      // 44' = 0x8000002C: bytes LE = [0x2C, 0x00, 0x00, 0x80]
      const paths = DerivationPathUtils.splitPath("44'/1005'/0'/0'/0'");
      // ACT
      const result = encodeDerivationPath(paths);
      // ASSERT
      expect(result[0]).toBe(0x2c); // LSB of 0x8000002C
      expect(result[3]).toBe(0x80); // MSB of 0x8000002C
    });
  });

  describe("Given a path with fewer than 5 elements", () => {
    it("should throw an error", () => {
      // ARRANGE
      const paths = [0x80000000 | 44, 0x80000000 | 1005, 0x80000000 | 0];
      // ACT & ASSERT
      expect(() => encodeDerivationPath(paths)).toThrow(
        "Expected 5 path elements, got 3",
      );
    });
  });

  describe("Given a path with more than 5 elements", () => {
    it("should throw an error", () => {
      // ARRANGE
      const paths = [
        0x80000000 | 44,
        0x80000000 | 1005,
        0x80000000 | 0,
        0x80000000 | 0,
        0x80000000 | 0,
        0x80000000 | 0,
      ];
      // ACT & ASSERT
      expect(() => encodeDerivationPath(paths)).toThrow(
        "Expected 5 path elements, got 6",
      );
    });
  });
});
