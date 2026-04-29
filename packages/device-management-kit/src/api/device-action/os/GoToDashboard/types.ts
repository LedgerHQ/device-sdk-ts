import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDARequiredInteraction,
  type GetDeviceStatusDAStateStep,
} from "@api/device-action/os/GetDeviceStatus/types";

export const goToDashboardDAStateStep = Object.freeze({
  GET_DEVICE_STATUS: "os.goToDashboard.steps.getDeviceStatus",
  DASHBOARD_CHECK: "os.goToDashboard.steps.dashboardCheck",
  CLOSE_APP: "os.goToDashboard.steps.closeApp",
  CONFIRM_DASHBOARD_OPEN: "os.goToDashboard.steps.confirmDashboardOpen",
} as const);

export type GoToDashboardDAStateStep =
  (typeof goToDashboardDAStateStep)[keyof typeof goToDashboardDAStateStep];

export type GoToDashboardDAOutput = void;
export type GoToDashboardDAInput = GetDeviceStatusDAInput;

export type GoToDashboardDAError =
  | GetDeviceStatusDAError
  | UnknownDAError
  | CommandErrorResult["error"];

export type GoToDashboardDARequiredInteraction =
  GetDeviceStatusDARequiredInteraction;

export type GoToDashboardDAIntermediateValue = {
  readonly requiredUserInteraction: GoToDashboardDARequiredInteraction;
  readonly step: GoToDashboardDAStateStep | GetDeviceStatusDAStateStep;
};

export type GoToDashboardDAState = DeviceActionState<
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue
>;
