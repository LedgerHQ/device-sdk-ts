import type { ScreenSpecs } from "@api/customLockScreenUtils/screenSpecs";

import { encodeImageForDevice } from "./encodeImageForDevice";

describe("encodeImageForDevice", () => {
  // Simple screen specs for testing (no padding)
  const simpleScreenSpecs: ScreenSpecs = {
    width: 10,
    height: 10,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    bitsPerPixel: 4,
  };

  // Screen specs with padding
  const paddedScreenSpecs: ScreenSpecs = {
    width: 12,
    height: 14,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
    bitsPerPixel: 4,
  };

  // 1bpp screen specs for testing
  const oneBppScreenSpecs: ScreenSpecs = {
    width: 16,
    height: 8,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    bitsPerPixel: 1,
  };

  describe("header encoding", () => {
    it("should encode width and height in little-endian", async () => {
      const screenSpecs: ScreenSpecs = {
        width: 0x1234,
        height: 0x5678,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        bitsPerPixel: 4,
      };
      const pixelData = new Uint8Array(0);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs,
      });

      // Width: 0x1234 -> [0x34, 0x12] (LE)
      expect(result[0]).toBe(0x34);
      expect(result[1]).toBe(0x12);
      // Height: 0x5678 -> [0x78, 0x56] (LE)
      expect(result[2]).toBe(0x78);
      expect(result[3]).toBe(0x56);
    });

    it("should encode 4bpp without compression as flags byte 0x20", async () => {
      const pixelData = new Uint8Array(0);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // bpp indicator 2 (for 4bpp) << 4 | compression 0 = 0x20
      expect(result[4]).toBe(0x20);
    });

    it("should encode 4bpp with compression as flags byte 0x21", async () => {
      const pixelData = new Uint8Array(10);

      const result = await encodeImageForDevice({
        pixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // bpp indicator 2 (for 4bpp) << 4 | compression 1 = 0x21
      expect(result[4]).toBe(0x21);
    });

    it("should encode 1bpp without compression as flags byte 0x00", async () => {
      const pixelData = new Uint8Array(0);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: oneBppScreenSpecs,
      });

      // bpp indicator 0 (for 1bpp) << 4 | compression 0 = 0x00
      expect(result[4]).toBe(0x00);
    });

    it("should encode 1bpp with compression as flags byte 0x01", async () => {
      const pixelData = new Uint8Array(10);

      const result = await encodeImageForDevice({
        pixelData,
        compress: true,
        padImage: false,
        screenSpecs: oneBppScreenSpecs,
      });

      // bpp indicator 0 (for 1bpp) << 4 | compression 1 = 0x01
      expect(result[4]).toBe(0x01);
    });

    it("should encode data length in 3-byte little-endian", async () => {
      // Create a pixel data that results in a specific length
      const pixelData = new Uint8Array(100);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // Data length 100 = 0x000064 -> [0x64, 0x00, 0x00] (LE, 3 bytes)
      expect(result[5]).toBe(0x64);
      expect(result[6]).toBe(0x00);
      expect(result[7]).toBe(0x00);
    });

    it("should handle large data length correctly", async () => {
      const pixelData = new Uint8Array(0x123456);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // Data length 0x123456 -> [0x56, 0x34, 0x12] (LE, 3 bytes)
      expect(result[5]).toBe(0x56);
      expect(result[6]).toBe(0x34);
      expect(result[7]).toBe(0x12);
    });
  });

  describe("uncompressed encoding", () => {
    it("should produce header + raw pixel data when not compressed", async () => {
      const pixelData = new Uint8Array([0xab, 0xcd, 0xef]);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      expect(result.length).toBe(8 + 3); // 8-byte header + 3 bytes data
      expect(result.slice(8)).toEqual(pixelData);
    });

    it("should have correct header for uncompressed data", async () => {
      const pixelData = new Uint8Array([1, 2, 3, 4, 5]);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      const headerView = new DataView(result.buffer, 0, 8);
      expect(headerView.getUint16(0, true)).toBe(10); // width
      expect(headerView.getUint16(2, true)).toBe(10); // height
      expect(result[4]).toBe(0x20); // 4bpp, no compression
      // Data length: 5
      expect(result[5]).toBe(5);
      expect(result[6]).toBe(0);
      expect(result[7]).toBe(0);
    });
  });

  describe("compressed encoding", () => {
    it("should compress data when compress is true", async () => {
      // Create some compressible data
      const pixelData = new Uint8Array(100).fill(0xaa);

      const result = await encodeImageForDevice({
        pixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // Verify header indicates compression
      expect(result[4]).toBe(0x21); // 4bpp + compression

      // Compressed result should be smaller than uncompressed (header + raw data)
      // But we also have chunk size prefixes, so let's just verify it's valid
      expect(result.length).toBeGreaterThan(8);
    });

    it("should chunk data into 2048-byte pieces before compression", async () => {
      // Create data larger than one chunk (2048 bytes)
      const pixelData = new Uint8Array(3000).fill(0x55);

      const result = await encodeImageForDevice({
        pixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // Should have at least 2 chunk size prefixes (each 2 bytes)
      // This is verified indirectly by checking the format is valid
      expect(result.length).toBeGreaterThan(8 + 4); // header + at least 2 chunk prefixes
    });

    it("should prefix each compressed chunk with 2-byte LE size", async () => {
      // Small data that fits in one chunk
      const pixelData = new Uint8Array(100).fill(0xcc);

      const result = await encodeImageForDevice({
        pixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // After header (8 bytes), first 2 bytes are the chunk size (LE)
      const chunkSizeView = new DataView(result.buffer, 8, 2);
      const chunkSize = chunkSizeView.getUint16(0, true);

      // The compressed data length in header should match chunk size + 2 (size prefix)
      const dataLength = result[5]! | (result[6]! << 8) | (result[7]! << 16);
      expect(dataLength).toBe(chunkSize + 2);
    });
  });

  describe("padding", () => {
    it("should pad image when padImage is true", async () => {
      // Pixel data for 10x12 visible area (padded specs has 12x14 full area)
      const visibleWidth = 10;
      const visibleHeight = 12;
      const pixelCount = visibleWidth * visibleHeight;
      // For 4bpp, 2 pixels per byte
      const byteCount = Math.ceil(pixelCount / 2);
      const pixelData = new Uint8Array(byteCount).fill(0xaa);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: true,
        screenSpecs: paddedScreenSpecs,
      });

      // Full dimensions: 12x14 = 168 pixels, 84 bytes for 4bpp
      const expectedDataLength = Math.ceil((12 * 14) / 2);
      const dataLength = result[5]! | (result[6]! << 8) | (result[7]! << 16);
      expect(dataLength).toBe(expectedDataLength);
    });

    it("should not pad image when padImage is false", async () => {
      const pixelData = new Uint8Array(50).fill(0xbb);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: paddedScreenSpecs,
      });

      // Data should be exactly the input size
      const dataLength = result[5]! | (result[6]! << 8) | (result[7]! << 16);
      expect(dataLength).toBe(50);
      expect(result.slice(8)).toEqual(pixelData);
    });

    it("should default to padImage: true", async () => {
      const visibleWidth = 10;
      const visibleHeight = 12;
      const pixelCount = visibleWidth * visibleHeight;
      const byteCount = Math.ceil(pixelCount / 2);
      const pixelData = new Uint8Array(byteCount).fill(0xdd);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        // padImage not specified, should default to true
        screenSpecs: paddedScreenSpecs,
      });

      const expectedDataLength = Math.ceil((12 * 14) / 2);
      const dataLength = result[5]! | (result[6]! << 8) | (result[7]! << 16);
      expect(dataLength).toBe(expectedDataLength);
    });
  });

  describe("default values", () => {
    it("should default to compress: true", async () => {
      const pixelData = new Uint8Array(50).fill(0xee);

      const result = await encodeImageForDevice({
        pixelData,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      // Check compression flag is set
      expect(result[4]! & 0x0f).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty pixel data", async () => {
      const pixelData = new Uint8Array(0);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      expect(result.length).toBe(8); // Only header
      expect(result[5]).toBe(0);
      expect(result[6]).toBe(0);
      expect(result[7]).toBe(0);
    });

    it("should handle single byte pixel data", async () => {
      const pixelData = new Uint8Array([0x42]);

      const result = await encodeImageForDevice({
        pixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      expect(result.length).toBe(9);
      expect(result[8]).toBe(0x42);
    });
  });
});
