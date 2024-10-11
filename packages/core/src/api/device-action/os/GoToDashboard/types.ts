import { CommandErrorResult } from "@api/command/model/CommandResult";
import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  GetDeviceStatusDAError,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAIntermediateValue,
} from "@api/device-action/os/GetDeviceStatus/types";

export type GoToDashboardDAOutput = void;
export type GoToDashboardDAInput = GetDeviceStatusDAInput;

export type GoToDashboardDAError =
  | GetDeviceStatusDAError
  | UnknownDAError
  | CommandErrorResult["error"];

export type GoToDashboardDARequiredInteraction = UserInteractionRequired.None;

export type GoToDashboardDAIntermediateValue =
  | GetDeviceStatusDAIntermediateValue
  | {
      readonly requiredUserInteraction: GoToDashboardDARequiredInteraction;
    };

export type GoToDashboardDAState = DeviceActionState<
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue
>;
