import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type OpenAppErrorCodes } from "@api/command/os/OpenAppCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeviceLockedError,
  type DeviceNotOnboardedError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";
import {
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAStateStep,
} from "@api/device-action/os/GetDeviceStatus/types";

export const openAppDAStateStep = Object.freeze({
  LIST_APPS: "os.openApp.steps.listApps",
  ONBOARD_CHECK: "os.openApp.steps.onboardCheck",
  GET_DEVICE_STATUS: "os.openApp.steps.getDeviceStatus",
  DASHBOARD_CHECK: "os.openApp.steps.dashboardCheck",
  CONFIRM_OPEN_APP: "os.openApp.steps.confirmOpenApp",
  CLOSE_APP: "os.openApp.steps.closeApp",
} as const);

export type OpenAppDAStateStep =
  (typeof openAppDAStateStep)[keyof typeof openAppDAStateStep];

export type OpenAppDAOutput = void;

export type OpenAppDAInput = GetDeviceStatusDAInput & {
  readonly appName: string;
};

export type OpenAppDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownDAError
  | CommandErrorResult<OpenAppErrorCodes | void>["error"];

export type OpenAppDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.ConfirmOpenApp;

export type OpenAppDAIntermediateValue = {
  readonly requiredUserInteraction: OpenAppDARequiredInteraction;
  readonly step: OpenAppDAStateStep | GetDeviceStatusDAStateStep;
};

export type OpenAppDAState = DeviceActionState<
  OpenAppDAOutput,
  OpenAppDAError,
  OpenAppDAIntermediateValue
>;
