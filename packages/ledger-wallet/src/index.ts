// Custom Lock Screen Utilities - Codec (device binary format)
export type { DecodeImageFromDeviceResult } from "./api/customLockScreenUtils/codec/decodeImageFromDevice";
export { decodeImageFromDevice } from "./api/customLockScreenUtils/codec/decodeImageFromDevice";
export type { EncodeImageForDeviceArgs } from "./api/customLockScreenUtils/codec/encodeImageForDevice";
export { encodeImageForDevice } from "./api/customLockScreenUtils/codec/encodeImageForDevice";

// Custom Lock Screen Utilities - Fit (resize/crop to screen)
// Note: These functions require a Web runtime environment (browser)
export { loadImageFromFile } from "./api/customLockScreenUtils/fit/canvasUtils";
export { centerCropResizeImage } from "./api/customLockScreenUtils/fit/imageFit";

// Custom Lock Screen Utilities - Grayscale (color conversion & dithering)
// Note: These functions require a Web runtime environment (browser)
export { convertToGrayscale as processImage } from "./api/customLockScreenUtils/grayscale/grayscaleDithering";
export { renderPixelDataToImage } from "./api/customLockScreenUtils/grayscale/pixelDataRenderer";

// Custom Lock Screen Utilities - Screen Specs
export type {
  CLSSupportedDeviceModelId,
  ScreenSpecs,
} from "./api/customLockScreenUtils/screenSpecs";
export {
  getScreenSpecs,
  getScreenVisibleAreaDimensions,
  isCustomLockScreenSupported,
} from "./api/customLockScreenUtils/screenSpecs";

// Custom Lock Screen Utilities - Types
export type {
  CenteredResult,
  DitheringAlgorithm,
  ImageDimensions,
  ProcessImageArgs,
  ProcessorResult,
  RenderPixelDataToImageArgs,
  RenderPixelDataToImageResult,
} from "./api/customLockScreenUtils/types";
export {
  ImageCropError,
  ImageResizeError,
  ImageSizeLoadingError,
} from "./api/customLockScreenUtils/types";
export {
  CustomLockScreenDeviceInternalErrorDAError,
  DeviceInRecoveryModeDAError,
  type DownloadCommandsDAError,
  InvalidCustomLockScreenImageDataDAError,
  InvalidCustomLockScreenStateDAError,
  NoCustomLockScreenImageDAError,
  type RemoveCommandDAError,
  type UploadCommandsDAError,
} from "./api/device-action/customLockScreenDeviceActionErrors";

// Device Actions
export { DownloadCustomLockScreenDeviceAction } from "./api/device-action/DownloadCustomLockScreen/DownloadCustomLockScreenDeviceAction";
export type {
  DownloadCustomLockScreenDAError,
  DownloadCustomLockScreenDAInput,
  DownloadCustomLockScreenDAIntermediateValue,
  DownloadCustomLockScreenDAOutput,
  DownloadCustomLockScreenDARequiredInteraction,
  DownloadCustomLockScreenDAState,
} from "./api/device-action/DownloadCustomLockScreen/types";
export { RemoveCustomLockScreenDeviceAction } from "./api/device-action/RemoveCustomLockScreen/RemoveCustomLockScreenDeviceAction";
export type {
  RemoveCustomLockScreenDAError,
  RemoveCustomLockScreenDAInput,
  RemoveCustomLockScreenDAIntermediateValue,
  RemoveCustomLockScreenDAOutput,
  RemoveCustomLockScreenDARequiredInteraction,
  RemoveCustomLockScreenDAState,
} from "./api/device-action/RemoveCustomLockScreen/types";
export type {
  UploadCustomLockScreenDAError,
  UploadCustomLockScreenDAInput,
  UploadCustomLockScreenDAIntermediateValue,
  UploadCustomLockScreenDAOutput,
  UploadCustomLockScreenDARequiredInteraction,
  UploadCustomLockScreenDAState,
} from "./api/device-action/UploadCustomLockScreen/types";
export { UploadCustomLockScreenDeviceAction } from "./api/device-action/UploadCustomLockScreen/UploadCustomLockScreenDeviceAction";
