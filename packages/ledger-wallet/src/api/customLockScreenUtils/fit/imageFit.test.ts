import { ImageCropError } from "@api/customLockScreenUtils/types";

import { getCenteredCropParams, getRescaledDimensions } from "./imageFit";

describe("imageFit", () => {
  describe("getRescaledDimensions", () => {
    it.each([
      // [description, image, container, expected]
      // Basic scaling behavior (cover)
      [
        "landscape image → portrait container",
        { width: 200, height: 100 },
        { width: 100, height: 200 },
        { width: 400, height: 200 },
      ],
      [
        "portrait image → landscape container",
        { width: 100, height: 200 },
        { width: 200, height: 100 },
        { width: 200, height: 400 },
      ],
      [
        "same aspect ratio",
        { width: 400, height: 200 },
        { width: 200, height: 100 },
        { width: 200, height: 100 },
      ],
      [
        "square image → landscape container",
        { width: 100, height: 100 },
        { width: 200, height: 100 },
        { width: 200, height: 200 },
      ],
      [
        "square image → portrait container",
        { width: 100, height: 100 },
        { width: 100, height: 200 },
        { width: 200, height: 200 },
      ],
      [
        "landscape image → square container",
        { width: 200, height: 100 },
        { width: 100, height: 100 },
        { width: 200, height: 100 },
      ],
      // Upscaling / downscaling
      [
        "upscale small image",
        { width: 50, height: 25 },
        { width: 200, height: 100 },
        { width: 200, height: 100 },
      ],
      [
        "downscale large image",
        { width: 1000, height: 500 },
        { width: 200, height: 100 },
        { width: 200, height: 100 },
      ],
      // Real-world device dimensions
      [
        "Stax screen (400x672) with 4:3 photo",
        { width: 4000, height: 3000 },
        { width: 400, height: 672 },
        { width: 896, height: 672 },
      ],
      [
        "Flex screen (480x600) with 3:4 photo",
        { width: 3000, height: 4000 },
        { width: 480, height: 600 },
        { width: 480, height: 640 },
      ],
      // Edge cases
      [
        "very small dimensions (1x1)",
        { width: 1, height: 1 },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
      ],
      [
        "fractional scaling with ceiling",
        { width: 10, height: 7 },
        { width: 5, height: 3 },
        { width: 5, height: 4 },
      ],
    ])("should handle %s", (_, image, container, expected) => {
      expect(getRescaledDimensions(image, container)).toEqual(expected);
    });

    it.each([
      [
        "container width is zero",
        { width: 100, height: 100 },
        { width: 0, height: 100 },
      ],
      [
        "container height is zero",
        { width: 100, height: 100 },
        { width: 100, height: 0 },
      ],
      [
        "image width is zero",
        { width: 0, height: 100 },
        { width: 100, height: 100 },
      ],
      [
        "image height is zero",
        { width: 100, height: 0 },
        { width: 100, height: 100 },
      ],
    ])("should return zero dimensions when %s", (_, image, container) => {
      expect(getRescaledDimensions(image, container)).toEqual({
        width: 0,
        height: 0,
      });
    });
  });

  describe("getCenteredCropParams", () => {
    it.each([
      // [description, image, crop, expected origin]
      // Basic centering
      [
        "centered crop for larger image",
        { width: 200, height: 200 },
        { width: 100, height: 100 },
        { originX: 50, originY: 50 },
      ],
      [
        "centered crop for landscape image",
        { width: 300, height: 100 },
        { width: 100, height: 100 },
        { originX: 100, originY: 0 },
      ],
      [
        "centered crop for portrait image",
        { width: 100, height: 300 },
        { width: 100, height: 100 },
        { originX: 0, originY: 100 },
      ],
      [
        "zero origin when dimensions match",
        { width: 100, height: 100 },
        { width: 100, height: 100 },
        { originX: 0, originY: 0 },
      ],
      // Odd dimension handling (floor on negative, then abs)
      [
        "odd differences (1px)",
        { width: 101, height: 101 },
        { width: 100, height: 100 },
        { originX: 1, originY: 1 },
      ],
      [
        "asymmetric odd differences",
        { width: 105, height: 103 },
        { width: 100, height: 100 },
        { originX: 3, originY: 2 },
      ],
      // Real-world scenarios
      [
        "Stax screen after rescaling (896x672 → 400x672)",
        { width: 896, height: 672 },
        { width: 400, height: 672 },
        { originX: 248, originY: 0 },
      ],
      [
        "Flex screen after rescaling (480x640 → 480x600)",
        { width: 480, height: 640 },
        { width: 480, height: 600 },
        { originX: 0, originY: 20 },
      ],
      // Edge cases
      [
        "very small dimensions (2x2 → 1x1)",
        { width: 2, height: 2 },
        { width: 1, height: 1 },
        { originX: 1, originY: 1 },
      ],
      [
        "large dimension differences",
        { width: 10000, height: 10000 },
        { width: 100, height: 100 },
        { originX: 4950, originY: 4950 },
      ],
    ])("should calculate %s", (_, image, crop, expectedOrigin) => {
      const result = getCenteredCropParams(image, crop);
      expect(result.originX).toBe(expectedOrigin.originX);
      expect(result.originY).toBe(expectedOrigin.originY);
      expect(result.width).toBe(crop.width);
      expect(result.height).toBe(crop.height);
    });

    it.each([
      [
        "crop width exceeds image width",
        { width: 100, height: 200 },
        { width: 150, height: 100 },
      ],
      [
        "crop height exceeds image height",
        { width: 200, height: 100 },
        { width: 100, height: 150 },
      ],
      [
        "both crop dimensions exceed image",
        { width: 100, height: 100 },
        { width: 200, height: 200 },
      ],
    ])("should throw ImageCropError when %s", (_, image, crop) => {
      expect(() => getCenteredCropParams(image, crop)).toThrow(ImageCropError);
      expect(() => getCenteredCropParams(image, crop)).toThrow(
        "The cropping dimensions must be smaller than the image dimensions",
      );
    });
  });

  describe("integration: getRescaledDimensions + getCenteredCropParams", () => {
    it("should work together for typical cover + crop workflow", () => {
      const imageDimensions = { width: 4000, height: 3000 };
      const targetDimensions = { width: 400, height: 672 };

      const rescaled = getRescaledDimensions(imageDimensions, targetDimensions);
      const cropParams = getCenteredCropParams(rescaled, targetDimensions);

      // Rescaled should cover the target
      expect(rescaled.width).toBeGreaterThanOrEqual(targetDimensions.width);
      expect(rescaled.height).toBeGreaterThanOrEqual(targetDimensions.height);

      // Crop dimensions should match target
      expect(cropParams.width).toBe(targetDimensions.width);
      expect(cropParams.height).toBe(targetDimensions.height);

      // Origin should be within bounds
      expect(cropParams.originX).toBeGreaterThanOrEqual(0);
      expect(cropParams.originY).toBeGreaterThanOrEqual(0);
      expect(cropParams.originX + cropParams.width).toBeLessThanOrEqual(
        rescaled.width,
      );
      expect(cropParams.originY + cropParams.height).toBeLessThanOrEqual(
        rescaled.height,
      );
    });
  });
});
