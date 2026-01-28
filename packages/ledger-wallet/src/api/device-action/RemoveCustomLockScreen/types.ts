import {
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type RemoveCommandDAError } from "@api/device-action/customLockScreenDeviceActionErrors";

/**
 * Input for removing a custom lock screen image.
 */
export type RemoveCustomLockScreenDAInput = GoToDashboardDAInput;

/**
 * Output returned when the custom lock screen image is successfully removed.
 */
export type RemoveCustomLockScreenDAOutput = void;

/**
 * Possible errors that can occur during the remove custom lock screen operation.
 * Based on Delete command errors: 5501, 6621, 662e, 662f
 */
export type RemoveCustomLockScreenDAError =
  | GoToDashboardDAError
  | RemoveCommandDAError;

/**
 * User interactions that may be required during the remove custom lock screen operation.
 */
export type RemoveCustomLockScreenDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.ConfirmRemoveImage;

/**
 * Intermediate value emitted during the remove custom lock screen operation.
 */
export type RemoveCustomLockScreenDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: RemoveCustomLockScreenDARequiredInteraction;
    };

/**
 * Full state type for the remove custom lock screen device action.
 */
export type RemoveCustomLockScreenDAState = DeviceActionState<
  RemoveCustomLockScreenDAOutput,
  RemoveCustomLockScreenDAError,
  RemoveCustomLockScreenDAIntermediateValue
>;
