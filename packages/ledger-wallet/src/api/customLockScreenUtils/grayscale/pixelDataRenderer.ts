import type {
  RenderPixelDataToImageArgs,
  RenderPixelDataToImageResult,
} from "@api/customLockScreenUtils/types";

/**
 * Render packed pixel data to a displayable image.
 *
 * This function takes the packed pixel data stored on the device and converts it
 * back into a displayable image. The data is organized by column from
 * right to left, top to bottom.
 *
 * **Note**: This function requires a Web runtime environment (browser) as it uses
 * the Canvas Web API.
 *
 * @param args - The render arguments
 * @returns The rendered image as a base64 data URI
 * @throws Error if canvas context cannot be obtained
 */
export function renderPixelDataToImage(
  args: RenderPixelDataToImageArgs,
): RenderPixelDataToImageResult {
  const { width, height, pixelData, bitsPerPixel } = args;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get canvas 2D context");
  }

  const imageData: number[] = [];

  const numLevelsOfGray = Math.pow(2, bitsPerPixel);
  const rgbStep = 255 / (numLevelsOfGray - 1);

  // Create a 2D array to store pixel values
  const pixels256: number[][] = Array.from(Array(height), () =>
    Array(width).fill(0),
  );

  // Parse packed pixel data back into pixel values
  let pixelIndex = 0;

  if (bitsPerPixel === 4) {
    // 4bpp: each byte contains 2 pixels (high nibble first)
    for (let byteIdx = 0; byteIdx < pixelData.length; byteIdx++) {
      const byte = pixelData[byteIdx]!;

      // High nibble (first pixel)
      const highNibble = (byte >> 4) & 0x0f;
      if (pixelIndex < width * height) {
        const y = pixelIndex % height;
        const x = width - 1 - Math.floor(pixelIndex / height);
        const val256 = highNibble * rgbStep;
        if (y >= 0 && y < height && x >= 0 && x < width) {
          pixels256[y]![x] = val256;
        }
        pixelIndex++;
      }

      // Low nibble (second pixel)
      const lowNibble = byte & 0x0f;
      if (pixelIndex < width * height) {
        const y = pixelIndex % height;
        const x = width - 1 - Math.floor(pixelIndex / height);
        const val256 = lowNibble * rgbStep;
        if (y >= 0 && y < height && x >= 0 && x < width) {
          pixels256[y]![x] = val256;
        }
        pixelIndex++;
      }
    }
  } else {
    // 1bpp: each byte contains 8 pixels (bit 7 first)
    for (let byteIdx = 0; byteIdx < pixelData.length; byteIdx++) {
      const byte = pixelData[byteIdx]!;

      for (let bit = 7; bit >= 0; bit--) {
        if (pixelIndex >= width * height) break;

        const y = pixelIndex % height;
        const x = width - 1 - Math.floor(pixelIndex / height);

        // Extract bit and invert (0 becomes white, 1 becomes black)
        const bitVal = (byte >> bit) & 1;
        const pixelVal = bitVal ? 0 : 255;

        if (y >= 0 && y < height && x >= 0 && x < width) {
          pixels256[y]![x] = pixelVal;
        }
        pixelIndex++;
      }
    }
  }

  // Convert to ImageData format
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = pixels256[y]![x]!;
      imageData.push(val); // R
      imageData.push(val); // G
      imageData.push(val); // B
      imageData.push(255); // alpha
    }
  }

  context.putImageData(
    new ImageData(Uint8ClampedArray.from(imageData), width, height),
    0,
    0,
  );

  const grayScaleBase64 = canvas.toDataURL();

  return {
    imageBase64DataUri: grayScaleBase64,
    width,
    height,
  };
}
