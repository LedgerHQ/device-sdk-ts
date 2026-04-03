/**
 * @fileoverview Image decoding for Ledger custom lock screen.
 *
 * This module decodes images from the binary format used by Ledger devices.
 *
 * @see encodeImageForDevice.ts for the format specification
 * @see CustomLockScreenDeviceActions.md for full documentation
 */

import { ungzip } from "pako";

import type { BitsPerPixel } from "@api/customLockScreenUtils/types";

import { concatUint8Arrays } from "./byteUtils";

const HEADER_SIZE = 8;
const HEIGHT_OFFSET = 2;
const FLAGS_INDEX = 4;
const DATA_LEN_BYTE_0 = 5;
const DATA_LEN_BYTE_1 = 6;
const DATA_LEN_BYTE_2 = 7;
const NIBBLE_SHIFT = 4;
const NIBBLE_MASK = 0x0f;
const BITS_PER_BYTE = 8;
const SHIFT_16 = 16;
const CHUNK_SIZE_PREFIX_BYTES = 2;

/**
 * Map from bpp indicator back to bitsPerPixel.
 * - 0 -> 1 bpp
 * - 2 -> 4 bpp
 */
const bppIndicatorToBitsPerPixel: Record<number, BitsPerPixel> = {
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
  bitsPerPixel: BitsPerPixel;
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
  if (data.length < HEADER_SIZE) {
    throw new Error("Invalid image data: too short for header");
  }

  const headerView = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);

  // Parse header
  const width = headerView.getUint16(0, true); // LE
  const height = headerView.getUint16(HEIGHT_OFFSET, true); // LE
  const flags = data[FLAGS_INDEX]!;
  const dataLength =
    data[DATA_LEN_BYTE_0]! |
    (data[DATA_LEN_BYTE_1]! << BITS_PER_BYTE) |
    (data[DATA_LEN_BYTE_2]! << SHIFT_16); // 3-byte LE

  // Parse flags
  const bppIndicator = (flags >> NIBBLE_SHIFT) & NIBBLE_MASK;
  const isCompressed = (flags & NIBBLE_MASK) === 1;

  const bitsPerPixel = bppIndicatorToBitsPerPixel[bppIndicator];
  if (bitsPerPixel === undefined) {
    throw new Error(`Invalid BPP indicator: ${bppIndicator}`);
  }

  // Extract data section
  const imageDataStart = HEADER_SIZE;
  const imageDataEnd = imageDataStart + dataLength;

  if (data.length < imageDataEnd) {
    throw new Error(
      `Invalid image data: expected ${dataLength} bytes but got ${data.length - HEADER_SIZE}`,
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
      if (offset + CHUNK_SIZE_PREFIX_BYTES > compressedOrRawData.length) {
        throw new Error("Invalid compressed data: incomplete chunk size");
      }

      const chunkSize =
        compressedOrRawData[offset]! |
        (compressedOrRawData[offset + 1]! << BITS_PER_BYTE);
      offset += CHUNK_SIZE_PREFIX_BYTES;

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
