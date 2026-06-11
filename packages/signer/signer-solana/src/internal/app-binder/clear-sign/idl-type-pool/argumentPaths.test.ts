import {
  ARRAY_ITERATE_ALL,
  packPath,
  packStep,
  PathPackError,
  pathsEqual,
  stepWidthForParent,
} from "./argumentPaths";
import * as K from "./kinds";

describe("argumentPaths", () => {
  describe("stepWidthForParent", () => {
    it("returns u8 width for STRUCT/TUPLE/OPTION parents", () => {
      expect(stepWidthForParent(K.KIND_STRUCT)).toBe(1);
      expect(stepWidthForParent(K.KIND_OPTION_DYNAMIC)).toBe(1);
    });

    it("returns u16 width for ARRAY parents", () => {
      expect(stepWidthForParent(K.KIND_ARRAY_PREFIXED)).toBe(2);
    });

    it("uses the disc kind width for ENUM parents", () => {
      expect(stepWidthForParent(K.KIND_ENUM, K.KIND_U8)).toBe(1);
      expect(stepWidthForParent(K.KIND_ENUM, K.KIND_U32)).toBe(4);
    });

    it("throws for an ENUM parent without a disc kind", () => {
      expect(() => stepWidthForParent(K.KIND_ENUM)).toThrow(PathPackError);
    });

    it("throws for a SHORT_U16 enum discriminator (no fixed BE width)", () => {
      expect(() => stepWidthForParent(K.KIND_ENUM, K.KIND_SHORT_U16)).toThrow(
        PathPackError,
      );
    });
  });

  describe("packStep / packPath", () => {
    it("packs a struct step as a single byte", () => {
      expect(Array.from(packStep(K.KIND_STRUCT, 5))).toEqual([5]);
    });

    it("packs an array step big-endian over two bytes", () => {
      expect(Array.from(packStep(K.KIND_ARRAY_FIXED, 0x0102))).toEqual([
        0x01, 0x02,
      ]);
    });

    it("packs the iterate-all sentinel", () => {
      expect(
        Array.from(packStep(K.KIND_ARRAY_FIXED, ARRAY_ITERATE_ALL)),
      ).toEqual([0xff, 0xff]);
    });

    it("packs a wide enum step above 2^31 without int32 corruption", () => {
      // u64-disc ENUM step value 0x1_0000_0000 (> 2^31). `& 0xff` would
      // corrupt this; `% 256` packs it big-endian over 8 bytes.
      expect(
        Array.from(packStep(K.KIND_ENUM, 0x1_0000_0000, K.KIND_U64)),
      ).toEqual([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
    });

    it("prefixes the step count", () => {
      const packed = packPath([
        [K.KIND_STRUCT, 1, undefined],
        [K.KIND_ARRAY_PREFIXED, 0x0203, undefined],
      ]);
      expect(Array.from(packed)).toEqual([2, 0x01, 0x02, 0x03]);
    });

    it("throws on an integer that is not safely representable", () => {
      // 2^53 is the first integer a JS number can no longer represent exactly.
      expect(() => packStep(K.KIND_ENUM, 2 ** 53, K.KIND_U64)).toThrow(
        PathPackError,
      );
    });

    it("throws when an array index overflows its width", () => {
      expect(() => packStep(K.KIND_ARRAY_FIXED, 0x1_0000)).toThrow(
        PathPackError,
      );
    });
  });

  describe("pathsEqual", () => {
    it("compares packed paths byte-for-byte", () => {
      expect(
        pathsEqual(
          packPath([[K.KIND_STRUCT, 2, undefined]]),
          Uint8Array.from([1, 2]),
        ),
      ).toBe(true);
      expect(pathsEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(
        false,
      );
      expect(pathsEqual(Uint8Array.from([1, 2]), Uint8Array.from([1]))).toBe(
        false,
      );
    });
  });
});
