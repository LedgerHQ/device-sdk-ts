/**
 * @fileoverview Image decoding for Ledger custom lock screen.
 *
 * This module decodes images from the binary format used by Ledger devices.
 *
 * @see encodeImageForDevice.ts for the format specification
 * @see CustomLockScreenDeviceActions.md for full documentation
 */

import { ungzip } from "pako";

import { concatUint8Arrays } from "./byteUtils";

/**
 * Map from bpp indicator back to bitsPerPixel.
 * - 0 -> 1 bpp
 * - 2 -> 4 bpp
 */
const bppIndicatorToBitsPerPixel: Record<number, 1 | 4> = {
  0: 1,
  2: 4,
};

/**
 * Result of decoding device image format.
 */
export type DecodeImageFromDeviceResult = {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Bits per pixel (1 or 4) */
  bitsPerPixel: 1 | 4;
  /** Whether the data was compressed */
  wasCompressed: boolean;
  /** Raw packed pixel data (ready for renderPixelDataToImage) */
  pixelData: Uint8Array;
};

/**
 * Decode image data from the device's custom lock screen format.
 *
 * This function reverses what encodeImageForDevice does:
 * 1. Parses the 8-byte header to extract metadata
 * 2. If compressed, decompresses each gzip chunk
 * 3. Returns the raw packed pixel data for use with renderPixelDataToImage
 *
 * @param data - The raw image data from the device (Uint8Array)
 * @returns Decoded image data with metadata and packed pixel data
 * @throws Error if the data format is invalid
 */
export function decodeImageFromDevice(
  data: Uint8Array,
): DecodeImageFromDeviceResult {
  if (data.length < 8) {
    throw new Error("Invalid image data: too short for header");
  }

  const headerView = new DataView(data.buffer, data.byteOffset, 8);

  // Parse header
  const width = headerView.getUint16(0, true); // LE
  const height = headerView.getUint16(2, true); // LE
  const flags = data[4]!;
  const dataLength = data[5]! | (data[6]! << 8) | (data[7]! << 16); // 3-byte LE

  // Parse flags
  const bppIndicator = (flags >> 4) & 0x0f;
  const isCompressed = (flags & 0x0f) === 1;

  const bitsPerPixel = bppIndicatorToBitsPerPixel[bppIndicator];
  if (bitsPerPixel === undefined) {
    throw new Error(`Invalid BPP indicator: ${bppIndicator}`);
  }

  // Extract data section
  const imageDataStart = 8;
  const imageDataEnd = imageDataStart + dataLength;

  if (data.length < imageDataEnd) {
    throw new Error(
      `Invalid image data: expected ${dataLength} bytes but got ${data.length - 8}`,
    );
  }

  const compressedOrRawData = data.slice(imageDataStart, imageDataEnd);

  let rawPixelData: Uint8Array;

  if (isCompressed) {
    // Decompress chunked gzip data
    const decompressedChunks: Uint8Array[] = [];
    let offset = 0;

    while (offset < compressedOrRawData.length) {
      // Read 2-byte LE chunk size
      if (offset + 2 > compressedOrRawData.length) {
        throw new Error("Invalid compressed data: incomplete chunk size");
      }

      const chunkSize =
        compressedOrRawData[offset]! | (compressedOrRawData[offset + 1]! << 8);
      offset += 2;

      if (offset + chunkSize > compressedOrRawData.length) {
        throw new Error("Invalid compressed data: incomplete chunk");
      }

      const compressedChunk = compressedOrRawData.slice(
        offset,
        offset + chunkSize,
      );
      offset += chunkSize;

      // Decompress chunk
      const decompressedChunk = ungzip(compressedChunk);
      decompressedChunks.push(decompressedChunk);
    }

    rawPixelData = concatUint8Arrays(decompressedChunks);
  } else {
    rawPixelData = compressedOrRawData;
  }

  return {
    width,
    height,
    bitsPerPixel,
    wasCompressed: isCompressed,
    pixelData: rawPixelData,
  };
}
