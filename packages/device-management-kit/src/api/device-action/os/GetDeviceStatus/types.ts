import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type DeviceNotOnboardedError } from "@api/device-action/os/Errors";
import { type WaitForAppAndVersionDAError } from "@api/device-action/os/WaitForAppAndVersion/types";

export const getDeviceStatusDAStateStep = Object.freeze({
  WAIT_FOR_APP_AND_VERSION: "os.getDeviceStatus.steps.waitForAppAndVersion",
  ONBOARD_CHECK: "os.getDeviceStatus.steps.onboardCheck",
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
  | WaitForAppAndVersionDAError
  | DeviceNotOnboardedError;

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
