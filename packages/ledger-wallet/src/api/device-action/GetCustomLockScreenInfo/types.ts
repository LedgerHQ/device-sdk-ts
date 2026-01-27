import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type DownloadCommandsDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

/**
 * Input for getting custom lock screen info.
 */
export type GetCustomLockScreenInfoDAInput = GoToDashboardDAInput;

/**
 * Output returned when the custom lock screen info is successfully retrieved.
 * Returns a discriminated union indicating whether a custom lock screen exists.
 */
export type GetCustomLockScreenInfoDAOutput =
  | {
      /**
       * Indicates no custom lock screen is present on the device.
       */
      readonly hasCustomLockScreen: false;
    }
  | {
      /**
       * Indicates a custom lock screen is present on the device.
       */
      readonly hasCustomLockScreen: true;
      /**
       * Size of the custom lock screen image in bytes.
       */
      readonly sizeBytes: number;
      /**
       * Hash of the custom lock screen image.
       */
      readonly hash: string;
    };

/**
 * Possible errors that can occur during the get custom lock screen info operation.
 * Based on GetSize/GetHash command errors:
 * - GetSize: 662e (no image - handled as success), 662f (recovery mode)
 * - GetHash: 662e (no image), 662f (recovery mode)
 */
export type GetCustomLockScreenInfoDAError =
  | GoToDashboardDAError
  | DownloadCommandsDAError;

/**
 * User interactions that may be required during the get custom lock screen info operation.
 */
export type GetCustomLockScreenInfoDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice;

/**
 * Intermediate value emitted during the get custom lock screen info operation.
 */
export type GetCustomLockScreenInfoDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: GetCustomLockScreenInfoDARequiredInteraction;
    };

/**
 * Full state type for the get custom lock screen info device action.
 */
export type GetCustomLockScreenInfoDAState = DeviceActionState<
  GetCustomLockScreenInfoDAOutput,
  GetCustomLockScreenInfoDAError,
  GetCustomLockScreenInfoDAIntermediateValue
>;
