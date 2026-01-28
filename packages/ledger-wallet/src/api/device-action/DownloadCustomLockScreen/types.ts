import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type DownloadCommandsDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

/**
 * Input for fetching a custom lock screen image.
 */
export type DownloadCustomLockScreenDAInput = GoToDashboardDAInput & {
  /**
   * Optional hash to compare with the current image.
   * If the current image hash matches, the fetch will be skipped.
   */
  readonly backupHash?: string;
  /**
   * If true, completes successfully when no image is present.
   * If false (default), throws an error when no image is present.
   */
  readonly allowedEmpty?: boolean;
};

/**
 * Output returned when the custom lock screen image is successfully fetched.
 */
export type DownloadCustomLockScreenDAOutput =
  | {
      /**
       * The fetched image data.
       */
      readonly imageData: Uint8Array;
      /**
       * The hash of the image.
       */
      readonly imageHash: string;
    }
  | {
      /**
       * Indicates the image was already backed up (hash matches backupHash).
       */
      readonly alreadyBackedUp: true;
    };

/**
 * Possible errors that can occur during the fetch custom lock screen operation.
 * Based on GetHash/GetSize/Fetch command errors:
 * - GetHash: 662e, 662f
 * - GetSize: 662f
 * - Fetch: 662e, 662f, 6832
 */
export type DownloadCustomLockScreenDAError =
  | GoToDashboardDAError
  | DownloadCommandsDAError;

/**
 * User interactions that may be required during the fetch custom lock screen operation.
 */
export type DownloadCustomLockScreenDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice;

/**
 * Intermediate value emitted during the fetch custom lock screen operation.
 */
export type DownloadCustomLockScreenDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: DownloadCustomLockScreenDARequiredInteraction;
      /**
       * Progress of the image fetch (0 to 1).
       * Only present during the fetch phase.
       */
      readonly progress?: number;
      /**
       * The hash of the current image on the device.
       * Emitted early in the process to allow comparison.
       */
      readonly currentImageHash?: string;
    };

/**
 * Full state type for the fetch custom lock screen device action.
 */
export type DownloadCustomLockScreenDAState = DeviceActionState<
  DownloadCustomLockScreenDAOutput,
  DownloadCustomLockScreenDAError,
  DownloadCustomLockScreenDAIntermediateValue
>;
