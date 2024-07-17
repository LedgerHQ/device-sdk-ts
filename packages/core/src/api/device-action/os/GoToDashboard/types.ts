import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/errors";
import {
  GetDeviceStatusDAError,
  GetDeviceStatusDAInput,
  GetDeviceStatusDARequiredInteraction,
} from "@api/device-action/os/GetDeviceStatus/types";
import { SdkError } from "@api/Error";

export type GoToDashboardDAOutput = void;
export type GoToDashboardDAInput = GetDeviceStatusDAInput;

export type GoToDashboardDAError =
  | GetDeviceStatusDAError
  | UnknownDAError
  | SdkError; /// TODO: remove, we should have an exhaustive list of errors

export type GoToDashboardDARequiredInteraction =
  | GetDeviceStatusDARequiredInteraction
  | UserInteractionRequired.UnlockDevice;

export type GoToDashboardDAIntermediateValue = {
  requiredUserInteraction: GoToDashboardDARequiredInteraction;
};

export type GoToDashboardDAState = DeviceActionState<
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue
>;
