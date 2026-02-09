/**
 * Create a canvas element with optional image dimensions.
 *
 * @param image - Optional image to set canvas dimensions from
 * @returns Object containing the canvas and its 2D context
 */
export function createCanvas(image?: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
} {
  const canvas = document.createElement("canvas");
  if (image) {
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
  }
  const context = canvas.getContext("2d");
  return { canvas, context };
}

/**
 * Load an image from a URL or data URI.
 *
 * @param src - The image source (URL or data URI)
 * @returns Promise resolving to the loaded HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = src;
  });
}

/**
 * Load an image from a File object.
 *
 * **Note**: This function requires a Web runtime environment (browser) as it uses
 * the FileReader and Image Web APIs.
 *
 * @param file - The file to load
 * @returns Promise resolving to the loaded HTMLImageElement
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        loadImage(reader.result).then(resolve).catch(reject);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Get the dimensions of an image from its URL or data URI.
 *
 * @param src - The image source
 * @returns Promise resolving to the image dimensions
 */
export function getImageDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  return loadImage(src).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
}

/**
 * Convert canvas to base64 data URI.
 *
 * @param canvas - The canvas element
 * @param format - The image format (default: 'image/png')
 * @param quality - The image quality for jpeg (0-1)
 * @returns The base64 data URI
 */
export function canvasToDataUri(
  canvas: HTMLCanvasElement,
  format: string = "image/png",
  quality?: number,
): string {
  return canvas.toDataURL(format, quality);
}

/**
 * Draw an image to a canvas with optional scaling.
 *
 * @param image - The image to draw
 * @param targetWidth - Target width (uses natural width if not specified)
 * @param targetHeight - Target height (uses natural height if not specified)
 * @returns Object containing the canvas and context
 */
export function drawImageToCanvas(
  image: HTMLImageElement,
  targetWidth?: number,
  targetHeight?: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const width = targetWidth ?? image.naturalWidth;
  const height = targetHeight ?? image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get canvas 2D context");
  }

  context.drawImage(image, 0, 0, width, height);

  return { canvas, context };
}
