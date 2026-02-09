import type { ScreenSpecs } from "@api/customLockScreenUtils/screenSpecs";

import { decodeImageFromDevice } from "./decodeImageFromDevice";
import { encodeImageForDevice } from "./encodeImageForDevice";

describe("decodeImageFromDevice", () => {
  describe("header parsing", () => {
    it("should parse width and height correctly (little-endian)", () => {
      // Build a valid header manually
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 0x1234, true); // width
      headerView.setUint16(2, 0x5678, true); // height
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 0; // data length
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.width).toBe(0x1234);
      expect(result.height).toBe(0x5678);
    });

    it("should parse 4bpp indicator correctly", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 100, true);
      headerView.setUint16(2, 100, true);
      header[4] = 0x20; // bpp indicator 2 (4bpp)
      header[5] = 0;
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.bitsPerPixel).toBe(4);
    });

    it("should parse 1bpp indicator correctly", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 100, true);
      headerView.setUint16(2, 100, true);
      header[4] = 0x00; // bpp indicator 0 (1bpp)
      header[5] = 0;
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.bitsPerPixel).toBe(1);
    });

    it("should parse compression flag correctly (compressed)", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 100, true);
      headerView.setUint16(2, 100, true);
      header[4] = 0x21; // 4bpp + compressed
      header[5] = 0;
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.wasCompressed).toBe(true);
    });

    it("should parse compression flag correctly (uncompressed)", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 100, true);
      headerView.setUint16(2, 100, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 0;
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.wasCompressed).toBe(false);
    });

    it("should parse 3-byte data length correctly", () => {
      // Create header with data length 0x123456
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 0x56; // lowest byte
      header[6] = 0x34; // middle byte
      header[7] = 0x12; // highest byte

      // Create data section of the correct length
      const data = new Uint8Array(8 + 0x123456);
      data.set(header, 0);

      const result = decodeImageFromDevice(data);

      expect(result.pixelData.length).toBe(0x123456);
    });
  });

  describe("uncompressed data", () => {
    it("should return raw pixel data directly", () => {
      const pixelData = new Uint8Array([0xab, 0xcd, 0xef, 0x12]);
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 4; // data length

      const fullData = new Uint8Array(8 + 4);
      fullData.set(header, 0);
      fullData.set(pixelData, 8);

      const result = decodeImageFromDevice(fullData);

      expect(result.pixelData).toEqual(pixelData);
      expect(result.wasCompressed).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw error for data shorter than header", () => {
      const shortData = new Uint8Array(7);

      expect(() => decodeImageFromDevice(shortData)).toThrow(
        "Invalid image data: too short for header",
      );
    });

    it("should throw error for invalid bpp indicator", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x30; // bpp indicator 3 (invalid)
      header[5] = 0;

      expect(() => decodeImageFromDevice(header)).toThrow(
        "Invalid BPP indicator: 3",
      );
    });

    it("should throw error when data length exceeds available bytes", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 100; // claims 100 bytes of data

      // Only provide 50 bytes of data
      const fullData = new Uint8Array(8 + 50);
      fullData.set(header, 0);

      expect(() => decodeImageFromDevice(fullData)).toThrow(
        "Invalid image data: expected 100 bytes but got 50",
      );
    });

    it("should throw error for incomplete chunk size in compressed data", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x21; // 4bpp + compressed
      header[5] = 1; // only 1 byte of data (incomplete chunk size)

      const fullData = new Uint8Array(8 + 1);
      fullData.set(header, 0);
      fullData[8] = 0x50; // incomplete size prefix

      expect(() => decodeImageFromDevice(fullData)).toThrow(
        "Invalid compressed data: incomplete chunk size",
      );
    });

    it("should throw error for incomplete chunk data", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x21; // 4bpp + compressed
      header[5] = 4; // 4 bytes: 2 for size prefix + 2 for "chunk"

      const fullData = new Uint8Array(8 + 4);
      fullData.set(header, 0);
      // Size prefix says chunk is 100 bytes
      fullData[8] = 100;
      fullData[9] = 0;
      // But only 2 bytes available
      fullData[10] = 0xaa;
      fullData[11] = 0xbb;

      expect(() => decodeImageFromDevice(fullData)).toThrow(
        "Invalid compressed data: incomplete chunk",
      );
    });
  });

  describe("round-trip tests (encode then decode)", () => {
    const simpleScreenSpecs: ScreenSpecs = {
      width: 10,
      height: 10,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      bitsPerPixel: 4,
    };

    const oneBppScreenSpecs: ScreenSpecs = {
      width: 16,
      height: 8,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      bitsPerPixel: 1,
    };

    it("should round-trip uncompressed 4bpp data correctly", async () => {
      const originalPixelData = new Uint8Array(50);
      for (let i = 0; i < 50; i++) originalPixelData[i] = i % 256;

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.width).toBe(simpleScreenSpecs.width);
      expect(decoded.height).toBe(simpleScreenSpecs.height);
      expect(decoded.bitsPerPixel).toBe(4);
      expect(decoded.wasCompressed).toBe(false);
      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip compressed 4bpp data correctly", async () => {
      const originalPixelData = new Uint8Array(100);
      for (let i = 0; i < 100; i++) originalPixelData[i] = i % 256;

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.width).toBe(simpleScreenSpecs.width);
      expect(decoded.height).toBe(simpleScreenSpecs.height);
      expect(decoded.bitsPerPixel).toBe(4);
      expect(decoded.wasCompressed).toBe(true);
      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip uncompressed 1bpp data correctly", async () => {
      const originalPixelData = new Uint8Array(16); // 128 pixels at 1bpp
      for (let i = 0; i < 16; i++) originalPixelData[i] = i * 16;

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: false,
        padImage: false,
        screenSpecs: oneBppScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.width).toBe(oneBppScreenSpecs.width);
      expect(decoded.height).toBe(oneBppScreenSpecs.height);
      expect(decoded.bitsPerPixel).toBe(1);
      expect(decoded.wasCompressed).toBe(false);
      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip compressed 1bpp data correctly", async () => {
      const originalPixelData = new Uint8Array(16);
      for (let i = 0; i < 16; i++) originalPixelData[i] = i * 16;

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: true,
        padImage: false,
        screenSpecs: oneBppScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.width).toBe(oneBppScreenSpecs.width);
      expect(decoded.height).toBe(oneBppScreenSpecs.height);
      expect(decoded.bitsPerPixel).toBe(1);
      expect(decoded.wasCompressed).toBe(true);
      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip large compressed data (multiple chunks)", async () => {
      // Create data larger than chunk size (2048 bytes)
      const originalPixelData = new Uint8Array(5000);
      for (let i = 0; i < 5000; i++) originalPixelData[i] = i % 256;

      const largeScreenSpecs: ScreenSpecs = {
        width: 100,
        height: 100,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        bitsPerPixel: 4,
      };

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: true,
        padImage: false,
        screenSpecs: largeScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.wasCompressed).toBe(true);
      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip highly compressible data correctly", async () => {
      // All zeros - should compress very well
      const originalPixelData = new Uint8Array(1000).fill(0);

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: true,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.pixelData).toEqual(originalPixelData);
    });

    it("should round-trip empty data correctly", async () => {
      const originalPixelData = new Uint8Array(0);

      const encoded = await encodeImageForDevice({
        pixelData: originalPixelData,
        compress: false,
        padImage: false,
        screenSpecs: simpleScreenSpecs,
      });

      const decoded = decodeImageFromDevice(encoded);

      expect(decoded.pixelData.length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle minimum valid data (header only, no pixel data)", () => {
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 0;
      header[6] = 0;
      header[7] = 0;

      const result = decodeImageFromDevice(header);

      expect(result.pixelData.length).toBe(0);
    });

    it("should handle data with extra trailing bytes", () => {
      const pixelData = new Uint8Array([0x11, 0x22, 0x33]);
      const header = new Uint8Array(8);
      const headerView = new DataView(header.buffer);
      headerView.setUint16(0, 10, true);
      headerView.setUint16(2, 10, true);
      header[4] = 0x20; // 4bpp, no compression
      header[5] = 3; // data length

      // Include extra bytes at the end
      const fullData = new Uint8Array(8 + 3 + 10);
      fullData.set(header, 0);
      fullData.set(pixelData, 8);
      fullData.set(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]), 11);

      const result = decodeImageFromDevice(fullData);

      // Should only return the declared data length
      expect(result.pixelData).toEqual(pixelData);
    });

    it("should correctly handle buffer with byte offset", () => {
      // Create a larger buffer and use a view with offset
      const largeBuffer = new ArrayBuffer(100);
      const fullArray = new Uint8Array(largeBuffer);

      // Put some garbage at the start
      fullArray.set([0xff, 0xff, 0xff, 0xff], 0);

      // Put header at offset 4
      const headerOffset = 4;
      const headerView = new DataView(largeBuffer, headerOffset, 8);
      headerView.setUint16(0, 20, true); // width
      headerView.setUint16(2, 30, true); // height
      fullArray[headerOffset + 4] = 0x20; // 4bpp, no compression
      fullArray[headerOffset + 5] = 2; // data length

      // Put pixel data
      fullArray[headerOffset + 8] = 0xab;
      fullArray[headerOffset + 9] = 0xcd;

      // Create a Uint8Array view starting at the header
      const dataView = new Uint8Array(largeBuffer, headerOffset, 8 + 2);

      const result = decodeImageFromDevice(dataView);

      expect(result.width).toBe(20);
      expect(result.height).toBe(30);
      expect(result.pixelData).toEqual(new Uint8Array([0xab, 0xcd]));
    });
  });
});
