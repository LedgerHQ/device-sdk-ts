import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type PictureInputValues = {
  /** The processed image data as a hex string */
  imageDataHex: string;
  unlockTimeout: number;
};

export type PictureInputProps = {
  initialValues: PictureInputValues;
  onChange: (values: PictureInputValues) => void;
  deviceModelId: DeviceModelId;
  disabled?: boolean;
};

// Re-export types from sub-components for convenience
export type { ImageDropZoneProps } from "./ImageDropZone";
export type { ImagePreviewsProps } from "./ImagePreviews";
export type { ImageProcessingControlsProps } from "./ImageProcessingControls";
export type {
  FileDragDropHandlers,
  UseFileDragDropOptions,
  UseFileDragDropResult,
} from "./useFileDragDrop";
