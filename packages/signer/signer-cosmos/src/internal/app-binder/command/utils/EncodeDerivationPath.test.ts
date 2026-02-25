import { describe, expect, it } from "vitest";

import { encodeDerivationPath } from "./EncodeDerivationPath";

describe("encodeDerivationPath", () => {
  describe("Given a 5-level derivation path", () => {
    describe("When encoding a standard Cosmos path (44'/118'/0'/0/0)", () => {
      it("Then it should return a 20-byte buffer", () => {
        const result = encodeDerivationPath([44, 118, 0, 0, 0]);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(20);
      });

      it("Then it should set hardened bit for the first three levels", () => {
        const result = encodeDerivationPath([44, 118, 0, 0, 0]);
        const dataView = new DataView(
          result.buffer,
          result.byteOffset,
          result.byteLength,
        );
        // First 3 levels: high bit set (hardened); compare as unsigned 32-bit
        expect(dataView.getUint32(0, true)).toBe((0x80000000 | 44) >>> 0);
        expect(dataView.getUint32(4, true)).toBe((0x80000000 | 118) >>> 0);
        expect(dataView.getUint32(8, true)).toBe((0x80000000 | 0) >>> 0);
      });

      it("Then it should not set hardened bit for the last two levels", () => {
        const result = encodeDerivationPath([44, 118, 0, 0, 0]);
        const dataView = new DataView(
          result.buffer,
          result.byteOffset,
          result.byteLength,
        );
        expect(dataView.getUint32(12, true)).toBe(0);
        expect(dataView.getUint32(16, true)).toBe(0);
      });

      it("Then it should encode each level as little-endian uint32", () => {
        const result = encodeDerivationPath([44, 118, 0, 0, 0]);
        const expected = new Uint8Array(20);
        const expectedView = new DataView(expected.buffer);
        expectedView.setUint32(0, 0x80000000 | 44, true);
        expectedView.setUint32(4, 0x80000000 | 118, true);
        expectedView.setUint32(8, 0x80000000 | 0, true);
        expectedView.setUint32(12, 0, true);
        expectedView.setUint32(16, 0, true);
        expect(result).toStrictEqual(expected);
      });
    });

    describe("When encoding a path with non-zero account and index", () => {
      it("Then it should encode account and index without hardened bit", () => {
        const result = encodeDerivationPath([44, 118, 0, 1, 2]);
        const dataView = new DataView(
          result.buffer,
          result.byteOffset,
          result.byteLength,
        );
        expect(dataView.getUint32(12, true)).toBe(1);
        expect(dataView.getUint32(16, true)).toBe(2);
      });
    });

    describe("When encoding path values with high bits set", () => {
      it("Then it should mask each level to 31 bits before applying hardened bit", () => {
        const result = encodeDerivationPath([
          0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
        ]);
        const dataView = new DataView(
          result.buffer,
          result.byteOffset,
          result.byteLength,
        );
        // 0xffffffff & 0x7fffffff = 0x7fffffff; first 3 get hardened; compare as unsigned 32-bit
        expect(dataView.getUint32(0, true)).toBe(
          (0x80000000 | 0x7fffffff) >>> 0,
        );
        expect(dataView.getUint32(4, true)).toBe(
          (0x80000000 | 0x7fffffff) >>> 0,
        );
        expect(dataView.getUint32(8, true)).toBe(
          (0x80000000 | 0x7fffffff) >>> 0,
        );
        expect(dataView.getUint32(12, true)).toBe(0x7fffffff >>> 0);
        expect(dataView.getUint32(16, true)).toBe(0x7fffffff >>> 0);
      });
    });
  });
});
