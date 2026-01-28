import { DeviceModelId } from "@ledgerhq/device-management-kit";

/**
 * Device model IDs that support custom lock screen functionality.
 */
export const CLS_SUPPORTED_DEVICE_MODEL_IDS = [
  DeviceModelId.STAX,
  DeviceModelId.FLEX,
  DeviceModelId.APEX,
] as const;

/**
 * Type representing device models that support custom lock screen.
 */
export type CLSSupportedDeviceModelId =
  (typeof CLS_SUPPORTED_DEVICE_MODEL_IDS)[number];

/**
 * Screen specifications for custom lock screen devices.
 */
export type ScreenSpecs = {
  /** Width of the screen in pixels */
  readonly width: number;
  /** Height of the screen in pixels */
  readonly height: number;
  /** Number of pixels at the top of the screen which are not visible */
  readonly paddingTop: number;
  /** Number of pixels at the bottom of the screen which are not visible */
  readonly paddingBottom: number;
  /** Number of pixels at the left of the screen which are not visible */
  readonly paddingLeft: number;
  /** Number of pixels at the right of the screen which are not visible */
  readonly paddingRight: number;
  /** Number of bits per pixel (1 for black/white, 4 for 16 gray levels) */
  readonly bitsPerPixel: 1 | 4;
};

const NO_PADDING = {
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
} as const;

/**
 * Screen specifications for each CLS-supported device model.
 */
export const SCREEN_SPECS: Record<CLSSupportedDeviceModelId, ScreenSpecs> = {
  [DeviceModelId.STAX]: {
    width: 400,
    height: 672,
    ...NO_PADDING,
    paddingBottom: 2,
    bitsPerPixel: 4,
  },
  [DeviceModelId.FLEX]: {
    width: 480,
    height: 600,
    ...NO_PADDING,
    bitsPerPixel: 4,
  },
  [DeviceModelId.APEX]: {
    width: 300,
    height: 400,
    ...NO_PADDING,
    bitsPerPixel: 1,
  },
};

/**
 * Get screen specifications for a CLS-supported device model.
 * @param deviceModelId - The device model ID
 * @returns The screen specifications for the device
 */
export function getScreenSpecs(
  deviceModelId: CLSSupportedDeviceModelId,
): ScreenSpecs {
  return SCREEN_SPECS[deviceModelId];
}

/**
 * Get the full data dimensions (width x height) for a device's screen.
 * @param deviceModelId - The device model ID
 * @returns The width and height of the screen data
 */
export function getScreenDataDimensions(
  deviceModelId: CLSSupportedDeviceModelId,
): { width: number; height: number } {
  const { width, height } = SCREEN_SPECS[deviceModelId];
  return { width, height };
}

/**
 * Get the visible area dimensions (excluding padding) for a device's screen.
 * @param deviceModelId - The device model ID
 * @returns The width and height of the visible area
 */
export function getScreenVisibleAreaDimensions(
  deviceModelId: CLSSupportedDeviceModelId,
): { width: number; height: number } {
  const {
    width,
    height,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  } = SCREEN_SPECS[deviceModelId];
  return {
    width: width - paddingLeft - paddingRight,
    height: height - paddingTop - paddingBottom,
  };
}

/**
 * Check if a device model supports custom lock screen.
 * @param deviceModelId - The device model ID to check
 * @returns true if the device supports CLS, false otherwise
 */
export function isCustomLockScreenSupported(
  deviceModelId: DeviceModelId,
): deviceModelId is CLSSupportedDeviceModelId {
  return (CLS_SUPPORTED_DEVICE_MODEL_IDS as readonly DeviceModelId[]).includes(
    deviceModelId,
  );
}
