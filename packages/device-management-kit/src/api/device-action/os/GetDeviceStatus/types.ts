import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeviceLockedError,
  type DeviceNotOnboardedError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";

export type GetDeviceStatusDAOutput = {
  readonly currentApp: string;
  readonly currentAppVersion: string;
};
export type GetDeviceStatusDAInput = {
  readonly unlockTimeout?: number;
};

export type GetDeviceStatusDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownDAError
  | CommandErrorResult["error"];

export type GetDeviceStatusDARequiredInteraction =
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
