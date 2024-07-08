import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/errors";
import { SdkError } from "@api/Error";

export type GetDeviceStatusDAOutput = {
  currentApp: string | null;
};
export type GetDeviceStatusDAInput = null;

export type GetDeviceStatusDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownDAError
  | SdkError; /// TODO: remove, we should have an exhaustive list of errors

type GetDeviceStatusDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice;

export type GetDeviceStatusDAIntermediateValue = {
  requiredUserInteraction: GetDeviceStatusDARequiredInteraction;
};

export type GetDeviceStatusDAState = DeviceActionState<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue
>;
