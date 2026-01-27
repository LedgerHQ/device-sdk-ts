import { concatUint8Arrays } from "./byteUtils";

describe("byteUtils", () => {
  describe("concatUint8Arrays", () => {
    it("should return empty array when given empty array", () => {
      const result = concatUint8Arrays([]);

      expect(result).toEqual(new Uint8Array(0));
      expect(result.length).toBe(0);
    });

    it("should return same array when given single array", () => {
      const input = new Uint8Array([1, 2, 3, 4, 5]);

      const result = concatUint8Arrays([input]);

      expect(result).toEqual(input);
      expect(result.length).toBe(5);
    });

    it("should concatenate two arrays", () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([4, 5, 6]);

      const result = concatUint8Arrays([arr1, arr2]);

      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
      expect(result.length).toBe(6);
    });

    it("should concatenate multiple arrays", () => {
      const arr1 = new Uint8Array([1, 2]);
      const arr2 = new Uint8Array([3]);
      const arr3 = new Uint8Array([4, 5, 6]);
      const arr4 = new Uint8Array([7, 8]);

      const result = concatUint8Arrays([arr1, arr2, arr3, arr4]);

      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      expect(result.length).toBe(8);
    });

    it("should handle empty arrays in the middle", () => {
      const arr1 = new Uint8Array([1, 2]);
      const arr2 = new Uint8Array([]);
      const arr3 = new Uint8Array([3, 4]);

      const result = concatUint8Arrays([arr1, arr2, arr3]);

      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
      expect(result.length).toBe(4);
    });

    it("should handle all empty arrays", () => {
      const arr1 = new Uint8Array([]);
      const arr2 = new Uint8Array([]);

      const result = concatUint8Arrays([arr1, arr2]);

      expect(result).toEqual(new Uint8Array(0));
      expect(result.length).toBe(0);
    });

    it("should preserve byte values correctly", () => {
      const arr1 = new Uint8Array([0x00, 0xff]);
      const arr2 = new Uint8Array([0xab, 0xcd]);

      const result = concatUint8Arrays([arr1, arr2]);

      expect(result).toEqual(new Uint8Array([0x00, 0xff, 0xab, 0xcd]));
    });

    it("should create a new array (not modify inputs)", () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([4, 5, 6]);
      const originalArr1 = new Uint8Array([1, 2, 3]);
      const originalArr2 = new Uint8Array([4, 5, 6]);

      const result = concatUint8Arrays([arr1, arr2]);

      // Modify result
      result[0] = 99;

      // Original arrays should be unchanged
      expect(arr1).toEqual(originalArr1);
      expect(arr2).toEqual(originalArr2);
    });

    it("should handle large arrays", () => {
      const arr1 = new Uint8Array(1000).fill(0xaa);
      const arr2 = new Uint8Array(2000).fill(0xbb);

      const result = concatUint8Arrays([arr1, arr2]);

      expect(result.length).toBe(3000);
      expect(result.slice(0, 1000).every((v) => v === 0xaa)).toBe(true);
      expect(result.slice(1000).every((v) => v === 0xbb)).toBe(true);
    });
  });
});
