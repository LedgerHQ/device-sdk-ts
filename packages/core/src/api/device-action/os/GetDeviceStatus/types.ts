import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { SdkError } from "@api/Error";

export type GetDeviceStatusDAOutput = {
  readonly currentApp: string;
  readonly currentAppVersion: string | null;
};
export type GetDeviceStatusDAInput = {
  readonly unlockTimeout?: number;
};

export type GetDeviceStatusDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownDAError
  | SdkError; /// TODO: remove, we should have an exhaustive list of errors

export type GetDeviceStatusDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.AllowSecureConnection;

export type GetDeviceStatusDAIntermediateValue = {
  requiredUserInteraction: GetDeviceStatusDARequiredInteraction;
};

export type GetDeviceStatusDAState = DeviceActionState<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue
>;
