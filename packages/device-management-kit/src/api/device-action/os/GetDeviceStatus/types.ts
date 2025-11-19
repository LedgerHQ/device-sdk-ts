import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeviceLockedError,
  type DeviceNotOnboardedError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";

export const getDeviceStatusDAStateStep = Object.freeze({
  ONBOARD_CHECK: "os.getDeviceStatus.steps.onboardCheck",
  UNLOCK_DEVICE: "os.getDeviceStatus.steps.unlockDevice",
  APP_AND_VERSION_CHECK: "os.getDeviceStatus.steps.appAndVersionCheck",
} as const);

export type GetDeviceStatusDAStateStep =
  (typeof getDeviceStatusDAStateStep)[keyof typeof getDeviceStatusDAStateStep];

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
  step: GetDeviceStatusDAStateStep;
};

export type GetDeviceStatusDAState = DeviceActionState<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue
>;
