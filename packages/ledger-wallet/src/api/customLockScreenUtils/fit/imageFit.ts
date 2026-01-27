import {
  type CenteredResult,
  ImageCropError,
  type ImageDimensions,
  ImageResizeError,
  ImageSizeLoadingError,
} from "@api/customLockScreenUtils/types";

import { canvasToDataUri, loadImage } from "./canvasUtils";

/**
 * Returns the dimensions of an image that has been resized to fully cover a box,
 * while keeping its aspect ratio.
 * This behaves like the CSS `object-fit: cover` property.
 *
 * @param imageDimensions - The dimensions of the image to fit
 * @param containerDimensions - The dimensions of the container to fit in
 * @returns The dimensions of the image that fits in the container while keeping its aspect ratio
 */
export function getRescaledDimensions(
  imageDimensions: ImageDimensions,
  containerDimensions: ImageDimensions,
): ImageDimensions {
  if (
    [
      containerDimensions.width,
      containerDimensions.height,
      imageDimensions.width,
      imageDimensions.height,
    ].some((val) => val === 0)
  ) {
    return { height: 0, width: 0 };
  }

  const getImageRatio = (dimensions: ImageDimensions) =>
    dimensions.height / dimensions.width;

  const targetRatio = getImageRatio(containerDimensions);
  const imageRatio = getImageRatio(imageDimensions);

  const limitingDimension = targetRatio < imageRatio ? "width" : "height";

  const resizeRatio =
    limitingDimension === "width"
      ? containerDimensions.width / imageDimensions.width
      : containerDimensions.height / imageDimensions.height;

  return {
    width:
      limitingDimension === "width"
        ? containerDimensions.width
        : Math.ceil(imageDimensions.width * resizeRatio),
    height:
      limitingDimension === "height"
        ? containerDimensions.height
        : Math.ceil(imageDimensions.height * resizeRatio),
  };
}

/**
 * Crop parameters for centering an image.
 */
type CropParams = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/**
 * Returns the parameters to crop an image in the center.
 *
 * @param imageDimensions - The dimensions of the image to crop
 * @param cropDimensions - The dimensions of the container to crop in
 * @returns The parameters to crop the image in the center
 * @throws ImageCropError if crop dimensions are larger than image dimensions
 */
export function getCenteredCropParams(
  imageDimensions: ImageDimensions,
  cropDimensions: ImageDimensions,
): CropParams {
  if (
    cropDimensions.width > imageDimensions.width ||
    cropDimensions.height > imageDimensions.height
  ) {
    throw new ImageCropError(
      "The cropping dimensions must be smaller than the image dimensions",
    );
  }
  return {
    width: cropDimensions.width,
    height: cropDimensions.height,
    originX: Math.abs(
      Math.floor((cropDimensions.width - imageDimensions.width) / 2),
    ),
    originY: Math.abs(
      Math.floor((cropDimensions.height - imageDimensions.height) / 2),
    ),
  };
}

/**
 * Resize an image using canvas.
 *
 * @param image - The image to resize
 * @param targetDimensions - The target dimensions
 * @returns Promise resolving to the resized image as a data URI
 */
function resizeImage(
  image: HTMLImageElement,
  targetDimensions: ImageDimensions,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetDimensions.width;
  canvas.height = targetDimensions.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageResizeError("Could not get canvas context");
  }

  context.drawImage(
    image,
    0,
    0,
    targetDimensions.width,
    targetDimensions.height,
  );

  return canvasToDataUri(canvas);
}

/**
 * Crop an image from the center using canvas.
 *
 * @param image - The image to crop
 * @param cropParams - The crop parameters
 * @returns The cropped image as a data URI
 */
function cropImage(image: HTMLImageElement, cropParams: CropParams): string {
  const canvas = document.createElement("canvas");
  canvas.width = cropParams.width;
  canvas.height = cropParams.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageCropError("Could not get canvas context");
  }

  context.drawImage(
    image,
    cropParams.originX,
    cropParams.originY,
    cropParams.width,
    cropParams.height,
    0,
    0,
    cropParams.width,
    cropParams.height,
  );

  return canvasToDataUri(canvas);
}

/**
 * Center, crop, and resize an image to fit target dimensions.
 *
 * This function takes an image and resizes it to cover the target dimensions
 * while maintaining aspect ratio, then crops it from the center to exactly
 * match the target dimensions.
 *
 * **Note**: This function requires a Web runtime environment (browser) as it uses
 * the Canvas and Image Web APIs.
 *
 * @param imageUri - The source image URI or data URI
 * @param targetDimensions - The target dimensions for the output
 * @returns Promise resolving to the processed image result
 */
export async function centerCropResizeImage(
  imageUri: string,
  targetDimensions: ImageDimensions,
): Promise<CenteredResult> {
  // Load the source image
  let sourceImage: HTMLImageElement;
  try {
    sourceImage = await loadImage(imageUri);
  } catch (e) {
    throw new ImageSizeLoadingError(undefined, { cause: e });
  }

  const imageDimensions: ImageDimensions = {
    width: sourceImage.naturalWidth,
    height: sourceImage.naturalHeight,
  };

  // Calculate the dimensions needed to cover the target while maintaining aspect ratio
  const resizedImageDimensions = getRescaledDimensions(
    imageDimensions,
    targetDimensions,
  );

  // Calculate how to crop to center
  const cropParams = getCenteredCropParams(
    resizedImageDimensions,
    targetDimensions,
  );

  // Resize the image
  let resizedDataUri: string;
  try {
    resizedDataUri = resizeImage(sourceImage, resizedImageDimensions);
  } catch (e) {
    throw new ImageResizeError(undefined, { cause: e });
  }

  // Load the resized image
  let resizedImage: HTMLImageElement;
  try {
    resizedImage = await loadImage(resizedDataUri);
  } catch (e) {
    throw new ImageResizeError("Failed to load resized image", { cause: e });
  }

  // Crop from center
  let croppedDataUri: string;
  try {
    croppedDataUri = cropImage(resizedImage, cropParams);
  } catch (e) {
    throw new ImageCropError(undefined, { cause: e });
  }

  return {
    imageBase64DataUri: croppedDataUri,
    width: targetDimensions.width,
    height: targetDimensions.height,
  };
}

/**
 * Center, crop, and resize an image from a File object.
 *
 * @param file - The source image file
 * @param targetDimensions - The target dimensions for the output
 * @returns Promise resolving to the processed image result
 */
export async function centerCropResizeImageFromFile(
  file: File,
  targetDimensions: ImageDimensions,
): Promise<CenteredResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        centerCropResizeImage(reader.result, targetDimensions)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
