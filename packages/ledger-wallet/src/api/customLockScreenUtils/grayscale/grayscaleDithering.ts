import { createCanvas } from "@api/customLockScreenUtils/fit/canvasUtils";
import type {
  DitheringAlgorithm,
  ProcessImageArgs,
  ProcessorResult,
} from "@api/customLockScreenUtils/types";

/**
 * Clamp a value between min and max.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Apply contrast adjustment to an RGB value.
 */
function contrastRGB(rgbVal: number, contrastVal: number): number {
  return (rgbVal - 128) * contrastVal + 128;
}

/**
 * Helper function to safely apply error to a pixel during dithering.
 */
function applyErrorToPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  quantError: number,
  errorFraction: number,
  pixels256Colors: number[][],
): void {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    pixels256Colors[y]![x] = Math.floor(
      pixels256Colors[y]![x]! + quantError * errorFraction,
    );
  }
}

/**
 * Apply Floyd-Steinberg dithering.
 * https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering
 *
 *         x - 1  |   x    |  x + 1
 *   y            |   *    | 7 / 16
 * y + 1  3 / 16  | 5 / 16 | 1 / 16
 */
function applyFloydSteinbergDithering(
  x: number,
  y: number,
  width: number,
  height: number,
  quantError: number,
  pixels256Colors: number[][],
): void {
  applyErrorToPixel(
    x + 1,
    y,
    width,
    height,
    quantError,
    7 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x - 1,
    y + 1,
    width,
    height,
    quantError,
    3 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x,
    y + 1,
    width,
    height,
    quantError,
    5 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x + 1,
    y + 1,
    width,
    height,
    quantError,
    1 / 16,
    pixels256Colors,
  );
}

/**
 * Apply Atkinson dithering.
 * https://en.wikipedia.org/wiki/Atkinson_dithering
 *
 *         x - 1  |   x    |  x + 1 |  x + 2
 *   y            |   *    |  1 / 8 |  1 / 8
 * y + 1   1 / 8  | 1 / 8  |  1 / 8
 * y + 2          | 1 / 8  |
 */
function applyAtkinsonDithering(
  x: number,
  y: number,
  width: number,
  height: number,
  quantError: number,
  pixels256Colors: number[][],
): void {
  const errorFraction = 1 / 8;
  applyErrorToPixel(
    x + 1,
    y,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
  applyErrorToPixel(
    x + 2,
    y,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
  applyErrorToPixel(
    x - 1,
    y + 1,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
  applyErrorToPixel(
    x,
    y + 1,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
  applyErrorToPixel(
    x + 1,
    y + 1,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
  applyErrorToPixel(
    x,
    y + 2,
    width,
    height,
    quantError,
    errorFraction,
    pixels256Colors,
  );
}

/**
 * Apply reduced Atkinson dithering.
 *
 *    x    |  x + 1 |  x + 2
 *    *    | 2 / 16 | 1 / 16
 *  2 / 16 | 1 / 16 |
 */
function applyReducedAtkinsonDithering(
  x: number,
  y: number,
  width: number,
  height: number,
  quantError: number,
  pixels256Colors: number[][],
): void {
  applyErrorToPixel(
    x + 1,
    y,
    width,
    height,
    quantError,
    2 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x + 2,
    y,
    width,
    height,
    quantError,
    1 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x,
    y + 1,
    width,
    height,
    quantError,
    2 / 16,
    pixels256Colors,
  );
  applyErrorToPixel(
    x + 1,
    y + 1,
    width,
    height,
    quantError,
    1 / 16,
    pixels256Colors,
  );
}

/**
 * Calculate pixel lightness using HSL lightness calculation.
 * Provides better contrast preservation compared to simple RGB averaging.
 */
function calculatePixelLightness(pixel: number[]): number {
  const max = Math.max(pixel[0]!, pixel[1]!, pixel[2]!);
  const min = Math.min(pixel[0]!, pixel[1]!, pixel[2]!);
  return Math.floor((max + min) / 2.0);
}

/**
 * Apply grayscale, contrast, and dithering to image data.
 */
function applyFilter(
  imageData: ImageData,
  contrastAmount: number,
  ditheringAlgorithm: DitheringAlgorithm,
  bitsPerPixel: 1 | 4,
): { imageDataResult: Uint8ClampedArray; pixelDataResult: Uint8Array } {
  const filteredImageData: number[] = [];

  const data = imageData.data;

  // Determine number of gray levels based on bitsPerPixel
  const numLevelsOfGray = Math.pow(2, bitsPerPixel);
  const rgbStep = 255 / (numLevelsOfGray - 1);

  const { width, height } = imageData;

  const pixelsLightness: number[][] = Array.from(Array(height), () =>
    Array(width).fill(0),
  );
  const pixels256Colors: number[][] = Array.from(Array(height), () =>
    Array(width).fill(0),
  );
  const pixelsNColors: number[][] = Array.from(Array(height), () =>
    Array(width).fill(0),
  );

  // First pass: calculate lightness and apply contrast
  for (let pxIndex = 0; pxIndex < data.length / 4; pxIndex += 1) {
    const x = pxIndex % width;
    const y = (pxIndex - x) / width;

    const [redIndex, greenIndex, blueIndex] = [
      4 * pxIndex,
      4 * pxIndex + 1,
      4 * pxIndex + 2,
    ];
    const pixelLightness = calculatePixelLightness([
      data[redIndex]!,
      data[greenIndex]!,
      data[blueIndex]!,
    ]);
    pixelsLightness[y]![x] = pixelLightness;

    // Lightness value after applying the contrast
    pixels256Colors[y]![x] = clamp(
      contrastRGB(pixelLightness, contrastAmount),
      0,
      255,
    );
  }

  // Second pass: apply dithering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oldpixel = pixels256Colors[y]![x]!;

      let posterizedGray256: number;
      if (bitsPerPixel === 1) {
        posterizedGray256 = oldpixel >= 127 ? 255 : 0;
      } else {
        const posterizedGrayNColors = Math.floor(oldpixel / rgbStep);
        posterizedGray256 = posterizedGrayNColors * rgbStep;
      }

      const newpixel = posterizedGray256;
      pixels256Colors[y]![x] = newpixel;
      const quantError = oldpixel - newpixel;

      // Apply dithering based on algorithm
      switch (ditheringAlgorithm) {
        case "floyd-steinberg":
          applyFloydSteinbergDithering(
            x,
            y,
            width,
            height,
            quantError,
            pixels256Colors,
          );
          break;
        case "atkinson":
          applyAtkinsonDithering(
            x,
            y,
            width,
            height,
            quantError,
            pixels256Colors,
          );
          break;
        case "reduced-atkinson":
          applyReducedAtkinsonDithering(
            x,
            y,
            width,
            height,
            quantError,
            pixels256Colors,
          );
          break;
      }

      const valNColors = clamp(
        Math.floor(pixels256Colors[y]![x]! / rgbStep),
        0,
        numLevelsOfGray - 1,
      );
      pixelsNColors[y]![x] = valNColors;

      // Gray RGB value after applying the contrast, in [0,255]
      const val256Colors = valNColors * rgbStep;
      filteredImageData.push(val256Colors); // R
      filteredImageData.push(val256Colors); // G
      filteredImageData.push(val256Colors); // B
      filteredImageData.push(255); // alpha
    }
  }

  // Generate pixel data: by column, from right to left, from top to bottom
  const orderedPixelsNColors: number[] = [];
  for (let x = width; x--; ) {
    for (let y = 0; y < height; y++) {
      orderedPixelsNColors.push(pixelsNColors[y]![x]!);
    }
  }

  let pixelDataResult: Uint8Array;

  if (bitsPerPixel === 4) {
    // 4bpp: 2 pixels per byte (high nibble = first pixel, low nibble = second)
    const byteLength = Math.ceil(orderedPixelsNColors.length / 2);
    pixelDataResult = new Uint8Array(byteLength);
    for (let i = 0; i < orderedPixelsNColors.length; i += 2) {
      const highNibble = orderedPixelsNColors[i] ?? 0;
      const lowNibble = orderedPixelsNColors[i + 1] ?? 0;
      pixelDataResult[i / 2] = (highNibble << 4) | lowNibble;
    }
  } else {
    // 1bpp: 8 pixels per byte (bit 7 = first pixel, colors inverted)
    const byteLength = Math.ceil(orderedPixelsNColors.length / 8);
    pixelDataResult = new Uint8Array(byteLength);
    let byteIndex = 0;
    let bitIndex = 7;
    let currentByte = 0;

    for (const pixel of orderedPixelsNColors) {
      // Invert color bit (0 becomes 1, 1 becomes 0)
      const bit = 1 - (pixel & 1);
      currentByte |= bit << bitIndex;

      if (bitIndex === 0) {
        pixelDataResult[byteIndex] = currentByte;
        byteIndex++;
        bitIndex = 7;
        currentByte = 0;
      } else {
        bitIndex--;
      }
    }

    // Handle remaining bits (tail padding)
    if (bitIndex !== 7) {
      pixelDataResult[byteIndex] = currentByte;
    }
  }

  return {
    imageDataResult: Uint8ClampedArray.from(filteredImageData),
    pixelDataResult,
  };
}

/**
 * Process an image for custom lock screen display.
 *
 * Takes an image element and applies grayscale conversion, contrast adjustment,
 * and dithering to produce both a preview and raw data for device transfer.
 *
 * **Note**: This function requires a Web runtime environment (browser) as it uses
 * the Canvas Web API.
 *
 * @param args - Processing arguments including image, contrast, bitsPerPixel, and algorithm
 * @returns ProcessorResult with preview and raw data
 * @throws Error if canvas context cannot be obtained
 */
export function convertToGrayscale(args: ProcessImageArgs): ProcessorResult {
  const { image, contrast, bitsPerPixel, ditheringAlgorithm } = args;

  const { context, canvas } = createCanvas(image);
  if (!context) {
    throw new Error("Could not get canvas 2D context");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  const { naturalHeight: height, naturalWidth: width } = image;

  const { imageDataResult: grayData, pixelDataResult } = applyFilter(
    imageData,
    contrast,
    ditheringAlgorithm,
    bitsPerPixel,
  );

  const outputImageData = context.createImageData(width, height);
  outputImageData.data.set(grayData);
  context.putImageData(outputImageData, 0, 0);

  const grayScaleBase64 = canvas.toDataURL();

  return {
    previewResult: { imageBase64DataUri: grayScaleBase64, height, width },
    rawResult: { pixelData: pixelDataResult, height, width },
  };
}
