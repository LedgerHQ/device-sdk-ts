/**
 * @fileoverview Image encoding for Ledger custom lock screen.
 *
 * This module encodes images into the binary format expected by Ledger devices.
 * The format consists of:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        IMAGE DATA                               │
 * ├──────────────────────┬──────────────────────────────────────────┤
 * │      HEADER          │           COMPRESSED DATA                │
 * │      (8 bytes)       │         (variable length)                │
 * └──────────────────────┴──────────────────────────────────────────┘
 *
 * Header (8 bytes):
 * ┌────────┬────────┬────────┬────────────────────┐
 * │ Width  │ Height │ Flags  │ Data Length        │
 * │ (2B LE)│ (2B LE)│ (1B)   │ (3B LE)            │
 * └────────┴────────┴────────┴────────────────────┘
 *
 * Flags byte: (bpp_indicator << 4) | compression
 *   - bpp_indicator: 0 = 1bpp, 2 = 4bpp
 *   - compression: 0 = none, 1 = gzip
 *
 * Compressed data (when compression = 1):
 * ┌─────────────┬─────────────┬─────────────┐
 * │ Chunk 1     │ Chunk 2     │ Chunk N...  │
 * ├──────┬──────┼──────┬──────┼──────┬──────┤
 * │Size  │GZip  │Size  │GZip  │Size  │GZip  │
 * │(2B)  │Data  │(2B)  │Data  │(2B)  │Data  │
 * └──────┴──────┴──────┴──────┴──────┴──────┘
 * ```
 *
 * @see CustomLockScreenDeviceActions.md for full documentation
 */

import { gzip } from "pako";

import { concatUint8Arrays } from "@api/customLockScreenUtils/codec/byteUtils";
import type { ScreenSpecs } from "@api/customLockScreenUtils/screenSpecs";

/** Size of each chunk before compression (2048 bytes) */
const COMPRESS_CHUNK_SIZE = 2048;

/**
 * Map from bitsPerPixel to the bpp indicator used in the image header.
 * - 1 bpp -> 0
 * - 4 bpp -> 2
 */
const bitsPerPixelToBppIndicator: Record<ScreenSpecs["bitsPerPixel"], number> =
  {
    1: 0,
    4: 2,
  };

/**
 * Unpack pixel data from bytes to individual pixel values.
 * For 4bpp: each byte contains 2 pixels (high nibble first)
 * For 1bpp: each byte contains 8 pixels (bit 7 first)
 */
function unpackPixels(
  data: Uint8Array,
  bitsPerPixel: 1 | 4,
  pixelCount: number,
): number[] {
  const pixels: number[] = [];

  if (bitsPerPixel === 4) {
    for (let i = 0; i < data.length && pixels.length < pixelCount; i++) {
      const byte = data[i]!;
      pixels.push((byte >> 4) & 0x0f); // high nibble
      if (pixels.length < pixelCount) {
        pixels.push(byte & 0x0f); // low nibble
      }
    }
  } else {
    for (let i = 0; i < data.length && pixels.length < pixelCount; i++) {
      const byte = data[i]!;
      for (let bit = 7; bit >= 0 && pixels.length < pixelCount; bit--) {
        pixels.push((byte >> bit) & 1);
      }
    }
  }

  return pixels;
}

/**
 * Pack pixel values back into bytes.
 * For 4bpp: 2 pixels per byte (high nibble first)
 * For 1bpp: 8 pixels per byte (bit 7 first)
 */
function packPixels(pixels: number[], bitsPerPixel: 1 | 4): Uint8Array {
  if (bitsPerPixel === 4) {
    const byteLength = Math.ceil(pixels.length / 2);
    const result = new Uint8Array(byteLength);
    for (let i = 0; i < pixels.length; i += 2) {
      const high = pixels[i] ?? 0;
      const low = pixels[i + 1] ?? 0;
      result[i / 2] = (high << 4) | low;
    }
    return result;
  } else {
    const byteLength = Math.ceil(pixels.length / 8);
    const result = new Uint8Array(byteLength);
    for (let i = 0; i < pixels.length; i += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixel = pixels[i + bit] ?? 0;
        byte |= (pixel & 1) << (7 - bit);
      }
      result[i / 8] = byte;
    }
    return result;
  }
}

/**
 * Pad the pixel data to match the full screen dimensions including padding areas.
 *
 * The pixel data format:
 * - Pixels are packed into bytes (2 per byte for 4bpp, 8 per byte for 1bpp)
 * - Data starts from top-right corner, goes down the column, then to the next column left
 *
 * @param pixelData - The packed pixel data (without padding)
 * @param screenSpecs - The screen specifications
 * @returns The padded pixel data
 */
function padPixelData(
  pixelData: Uint8Array,
  screenSpecs: ScreenSpecs,
): Uint8Array {
  const sourceWidth =
    screenSpecs.width - screenSpecs.paddingLeft - screenSpecs.paddingRight;
  const sourceHeight =
    screenSpecs.height - screenSpecs.paddingTop - screenSpecs.paddingBottom;
  const destHeight = screenSpecs.height;
  const bitsPerPixel = screenSpecs.bitsPerPixel;

  // Unpack source pixels
  const sourcePixelCount = sourceWidth * sourceHeight;
  const sourcePixels = unpackPixels(pixelData, bitsPerPixel, sourcePixelCount);

  // Build padded pixel array
  const paddedPixels: number[] = [];

  // Add right padding (columns on the right side)
  for (let i = 0; i < screenSpecs.paddingRight * destHeight; i++) {
    paddedPixels.push(0);
  }

  // Add the image data with top/bottom padding for each column
  for (let columnIndex = 0; columnIndex < sourceWidth; columnIndex++) {
    // Top padding
    for (let i = 0; i < screenSpecs.paddingTop; i++) {
      paddedPixels.push(0);
    }
    // Column data
    for (let y = 0; y < sourceHeight; y++) {
      paddedPixels.push(sourcePixels[columnIndex * sourceHeight + y] ?? 0);
    }
    // Bottom padding
    for (let i = 0; i < screenSpecs.paddingBottom; i++) {
      paddedPixels.push(0);
    }
  }

  // Add left padding (columns on the left side)
  for (let i = 0; i < screenSpecs.paddingLeft * destHeight; i++) {
    paddedPixels.push(0);
  }

  // Pack back to bytes
  return packPixels(paddedPixels, bitsPerPixel);
}

export type EncodeImageForDeviceArgs = {
  /** The packed pixel data from processImage */
  pixelData: Uint8Array;
  /** Whether to compress the image data (recommended: true) */
  compress?: boolean;
  /**
   * Whether to pad the image to match screen specs.
   * - Use `true` (default) for fresh images processed from user input (visible area dimensions)
   * - Use `false` for images fetched from the device, which already include padding
   */
  padImage?: boolean;
  /** The screen specifications for the target device */
  screenSpecs: ScreenSpecs;
};

/**
 * Encode an image for the device's custom lock screen format.
 *
 * This function:
 * 1. Optionally pads the image to match screen dimensions (including padding areas)
 * 2. Creates an 8-byte header with width, height, bpp, compression flag, and data length
 * 3. Optionally compresses the image data using gzip in 2048-byte chunks
 *
 * Header format (8 bytes):
 * - Bytes 0-1: width (LE)
 * - Bytes 2-3: height (LE)
 * - Byte 4: (bpp << 4) | compression
 * - Bytes 5-7: data length (LE, 3 bytes)
 *
 * Compressed data format:
 * - Image is split into 2048-byte chunks
 * - Each chunk is gzipped
 * - Each compressed chunk is prefixed with 2-byte LE size
 *
 * @param args - The arguments for encoding the image
 * @returns A Uint8Array containing the formatted image data ready for the device
 */
export async function encodeImageForDevice(
  args: EncodeImageForDeviceArgs,
): Promise<Uint8Array> {
  const { pixelData, compress = true, padImage = true, screenSpecs } = args;

  const width = screenSpecs.width;
  const height = screenSpecs.height;
  const bpp = bitsPerPixelToBppIndicator[screenSpecs.bitsPerPixel];
  const compression = compress ? 1 : 0;

  // Create 8-byte header
  const header = new Uint8Array(8);
  const headerView = new DataView(header.buffer);

  headerView.setUint16(0, width, true); // width (LE)
  headerView.setUint16(2, height, true); // height (LE)
  header[4] = (bpp << 4) | compression;

  // Pad the image if needed
  const imgData = padImage ? padPixelData(pixelData, screenSpecs) : pixelData;

  if (!compress) {
    // Uncompressed: just set the data length and concatenate
    const dataLength = imgData.length;
    header[5] = dataLength & 0xff; // lowest byte
    header[6] = (dataLength >> 8) & 0xff; // middle byte
    header[7] = (dataLength >> 16) & 0xff; // highest byte

    return concatUint8Arrays([header, imgData]);
  }

  // Compressed: chunk and gzip each chunk
  const chunkedImgData: Uint8Array[] = [];
  for (let i = 0; i < imgData.length; i += COMPRESS_CHUNK_SIZE) {
    chunkedImgData.push(imgData.slice(i, i + COMPRESS_CHUNK_SIZE));
  }

  const compressedChunks: Uint8Array[] = await Promise.all(
    chunkedImgData.map(async (chunk) => {
      const compressedChunk = gzip(chunk);

      // Create 2-byte LE size prefix
      const sizePrefix = new Uint8Array(2);
      const sizeView = new DataView(sizePrefix.buffer);
      sizeView.setUint16(0, compressedChunk.length, true);

      return concatUint8Arrays([sizePrefix, compressedChunk]);
    }),
  );

  const compressedData = concatUint8Arrays(compressedChunks);
  const dataLength = compressedData.length;

  header[5] = dataLength & 0xff; // lowest byte
  header[6] = (dataLength >> 8) & 0xff; // middle byte
  header[7] = (dataLength >> 16) & 0xff; // highest byte

  return concatUint8Arrays([header, compressedData]);
}
