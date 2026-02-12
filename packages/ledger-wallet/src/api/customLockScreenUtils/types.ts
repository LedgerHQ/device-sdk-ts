/**
 * Type definitions for custom lock screen image processing utilities.
 */

/**
 * Dithering algorithms available for image processing.
 * - floyd-steinberg: Classic algorithm, spreads error to 4 neighboring pixels
 * - atkinson: Spreads error to 6 neighbors, preserves more detail
 * - reduced-atkinson: Variation with less spreading
 */
export type DitheringAlgorithm =
  | "floyd-steinberg"
  | "atkinson"
  | "reduced-atkinson";

/**
 * Arguments for the processImage function.
 */
export type ProcessImageArgs = {
  /**
   * The image element to process.
   * Must be fully loaded before passing to processImage.
   */
  readonly image: HTMLImageElement;
  /**
   * Contrast adjustment value.
   * - 0: full black
   * - 1: original contrast
   * - >1: more contrasted than the original
   */
  readonly contrast: number;
  /**
   * Number of bits per pixel for the output.
   * - 4: 16 levels of gray (for Stax, Flex)
   * - 1: 2 levels (black/white, for Apex)
   */
  readonly bitsPerPixel: 1 | 4;
  /**
   * The dithering algorithm to use.
   */
  readonly ditheringAlgorithm: DitheringAlgorithm;
};

/**
 * Preview result from image processing.
 */
export type ProcessorPreviewResult = {
  /**
   * Base64 data URI of the processed image for display.
   */
  readonly imageBase64DataUri: string;
  /**
   * Height of the processed image in pixels.
   */
  readonly height: number;
  /**
   * Width of the processed image in pixels.
   */
  readonly width: number;
};

/**
 * Raw result from image processing, ready for device transfer.
 */
export type ProcessorRawResult = {
  /**
   * Packed pixel data for device transfer.
   * - 4bpp: 2 pixels per byte (high nibble = first pixel)
   * - 1bpp: 8 pixels per byte (bit 7 = first pixel)
   */
  readonly pixelData: Uint8Array;
  /**
   * Height of the image in pixels.
   */
  readonly height: number;
  /**
   * Width of the image in pixels.
   */
  readonly width: number;
};

/**
 * Complete result from image processing.
 */
export type ProcessorResult = {
  /**
   * Image data that can be displayed as a preview.
   */
  readonly previewResult: ProcessorPreviewResult;
  /**
   * Image data that can be transferred to the device.
   */
  readonly rawResult: ProcessorRawResult;
};

/**
 * Image dimensions.
 */
export type ImageDimensions = {
  /**
   * Width in pixels.
   */
  readonly width: number;
  /**
   * Height in pixels.
   */
  readonly height: number;
};

/**
 * Base64 image data.
 */
export type ImageBase64Data = {
  /**
   * Image data as a base64 data URI.
   * Format: "data:[media type];base64,[data]"
   */
  readonly imageBase64DataUri: string;
};

/**
 * Result from centering and cropping an image.
 */
export type CenteredResult = ImageBase64Data & ImageDimensions;

/**
 * Arguments for rendering pixel data to a displayable image.
 */
export type RenderPixelDataToImageArgs = {
  /**
   * Width of the image in pixels.
   */
  readonly width: number;
  /**
   * Height of the image in pixels.
   */
  readonly height: number;
  /**
   * Packed pixel data from the device.
   * - 4bpp: 2 pixels per byte (high nibble = first pixel)
   * - 1bpp: 8 pixels per byte (bit 7 = first pixel)
   */
  readonly pixelData: Uint8Array;
  /**
   * Number of bits per pixel used in encoding.
   */
  readonly bitsPerPixel: 1 | 4;
};

/**
 * Result from rendering pixel data to image.
 */
export type RenderPixelDataToImageResult = {
  /**
   * Base64 data URI of the rendered image.
   */
  readonly imageBase64DataUri: string;
  /**
   * Width of the image in pixels.
   */
  readonly width: number;
  /**
   * Height of the image in pixels.
   */
  readonly height: number;
};

// Error classes for image processing

/**
 * Error thrown when image size cannot be loaded.
 */
export class ImageSizeLoadingError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "Failed to load image size", options);
    this.name = "ImageSizeLoadingError";
  }
}

/**
 * Error thrown when image resizing fails.
 */
export class ImageResizeError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "Failed to resize image", options);
    this.name = "ImageResizeError";
  }
}

/**
 * Error thrown when image cropping fails.
 */
export class ImageCropError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "Failed to crop image", options);
    this.name = "ImageCropError";
  }
}
