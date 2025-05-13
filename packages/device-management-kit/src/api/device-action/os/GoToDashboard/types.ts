import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDARequiredInteraction,
} from "@api/device-action/os/GetDeviceStatus/types";

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
};

export type GoToDashboardDAState = DeviceActionState<
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue
>;
