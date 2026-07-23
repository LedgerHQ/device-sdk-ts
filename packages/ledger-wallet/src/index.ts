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
export {
  BackupAppStorageCommand,
  type BackupAppStorageCommandErrorCodes,
  type BackupAppStorageCommandResponse,
  type BackupAppStorageCommandResult,
} from "./api/command/OsUpdate/Backup/BackupAppStorageCommand";
export {
  GetAppStorageInfoCommand,
  type GetAppStorageInfoCommandArgs,
  type GetAppStorageInfoCommandErrorCodes,
  type GetAppStorageInfoCommandResponse,
  type GetAppStorageInfoCommandResult,
} from "./api/command/OsUpdate/Backup/GetAppStorageInfoCommand";
export {
  CommitRestoreAppStorageCommand,
  CommitRestoreAppStorageCommandError,
  type CommitRestoreAppStorageCommandErrorCodes,
  type CommitRestoreAppStorageCommandResult,
} from "./api/command/OsUpdate/Restore/CommitRestoreAppStorageCommand";
export {
  InitRestoreAppStorageCommand,
  type InitRestoreAppStorageCommandArgs,
  InitRestoreAppStorageCommandError,
  type InitRestoreAppStorageCommandErrorCodes,
  type InitRestoreAppStorageCommandResult,
} from "./api/command/OsUpdate/Restore/InitRestoreAppStorageCommand";
export {
  RequestMasterConsentCommand,
  type RequestMasterConsentCommandArgs,
  type RequestMasterConsentCommandErrorCodes,
  type RequestMasterConsentCommandResult,
} from "./api/command/OsUpdate/Restore/RequestMasterConsentCommand";
export {
  RestoreAppStorageCommand,
  type RestoreAppStorageCommandArgs,
  RestoreAppStorageCommandError,
  type RestoreAppStorageCommandErrorCodes,
  type RestoreAppStorageCommandResult,
} from "./api/command/OsUpdate/Restore/RestoreAppStorageCommand";
export { DownloadCustomLockScreenDeviceAction } from "./api/device-action/DownloadCustomLockScreen/DownloadCustomLockScreenDeviceAction";
export type {
  DownloadCustomLockScreenDAError,
  DownloadCustomLockScreenDAInput,
  DownloadCustomLockScreenDAIntermediateValue,
  DownloadCustomLockScreenDAOutput,
  DownloadCustomLockScreenDARequiredInteraction,
  DownloadCustomLockScreenDAState,
} from "./api/device-action/DownloadCustomLockScreen/types";
export { GetCustomLockScreenInfoDeviceAction } from "./api/device-action/GetCustomLockScreenInfo/GetCustomLockScreenInfoDeviceAction";
export type {
  GetCustomLockScreenInfoDAError,
  GetCustomLockScreenInfoDAInput,
  GetCustomLockScreenInfoDAIntermediateValue,
  GetCustomLockScreenInfoDAOutput,
  GetCustomLockScreenInfoDARequiredInteraction,
  GetCustomLockScreenInfoDAState,
} from "./api/device-action/GetCustomLockScreenInfo/types";
export { CreateBackupDeviceAction } from "./api/device-action/OsUpdate/Backup/CreateBackupDeviceAction";
export type {
  CreateBackupDAError,
  CreateBackupDAInput,
  CreateBackupDAIntermediateValue,
  CreateBackupDAOutput,
  CreateBackupDARequiredInteraction,
  CreateBackupDAState,
  CreateBackupSteps,
} from "./api/device-action/OsUpdate/Backup/types";
export { RestoreAppsStorageDeviceAction } from "./api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceAction";
export type {
  RestoreAppsStorageDAError,
  RestoreAppsStorageDAInput,
  RestoreAppsStorageDAIntermediateValue,
  RestoreAppsStorageDAOutput,
  RestoreAppsStorageDARequiredInteraction,
  RestoreAppsStorageDAState,
  RestoreAppsStorageSteps,
  RestoreAppStorageResult,
} from "./api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";
export { RestoreBackupDeviceAction } from "./api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceAction";
export type {
  RestoreAppResult,
  RestoreBackupDAError,
  RestoreBackupDAInput,
  RestoreBackupDAIntermediateValue,
  RestoreBackupDAOutput,
  RestoreBackupDARequiredInteraction,
  RestoreBackupDAState,
  RestoreBackupSteps,
} from "./api/device-action/OsUpdate/Restore/RestoreBackup/types";
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
export { BackupAppStorageTask } from "./api/task/OsUpdate/Backup/BackupAppStorageTask";
export {
  RestoreAppStorageTask,
  type RestoreAppStorageTaskArgs,
  type RestoreAppStorageTaskError,
} from "./api/task/OsUpdate/Restore/RestoreAppStorageTask";
