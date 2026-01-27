import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type UploadCommandsDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

/**
 * Input required to upload a custom lock screen image.
 */
export type UploadCustomLockScreenDAInput = GoToDashboardDAInput & {
  /**
   * The image data as a Uint8Array.
   * This should be the properly formatted image data for the device.
   * cf. packages/ledger-wallet/doc/CustomLockScreenDeviceActions.md#image-data-format
   */
  readonly imageData: Uint8Array;
};

/**
 * Output returned when the custom lock screen image is successfully uploaded.
 */
export type UploadCustomLockScreenDAOutput = {
  /**
   * The hash of the uploaded image.
   */
  readonly imageHash: string;
  /**
   * The size of the uploaded image in bytes.
   */
  readonly imageSize: number;
};

/**
 * Possible errors that can occur during the upload custom lock screen operation.
 * Based on Create/Load/Commit command errors:
 * - Create: 662f, 5501, 5502
 * - Load: 5106, 551e, 662f, 6703, 680b
 * - Commit: 5501, 5502, 551e, 662f, 681f, 6820
 */
export type UploadCustomLockScreenDAError =
  | GoToDashboardDAError
  | UploadCommandsDAError;

/**
 * User interactions that may be required during the upload custom lock screen operation.
 */
export type UploadCustomLockScreenDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.ConfirmLoadImage
  | UserInteractionRequired.ConfirmCommitImage;

/**
 * Intermediate value emitted during the upload custom lock screen operation.
 */
export type UploadCustomLockScreenDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: UploadCustomLockScreenDARequiredInteraction;
      /**
       * Progress of the image upload (0 to 1).
       * Only present during the upload phase.
       */
      readonly progress?: number;
    };

/**
 * Full state type for the upload custom lock screen device action.
 */
export type UploadCustomLockScreenDAState = DeviceActionState<
  UploadCustomLockScreenDAOutput,
  UploadCustomLockScreenDAError,
  UploadCustomLockScreenDAIntermediateValue
>;
