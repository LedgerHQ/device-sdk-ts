import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type GetAppAndVersionResponse } from "@api/command/os/GetAppAndVersionCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeviceLockedError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";

export const waitForAppAndVersionDAStateStep = Object.freeze({
  GET_APP_AND_VERSION: "os.waitForAppAndVersion.steps.getAppAndVersion",
  UNLOCK_DEVICE: "os.waitForAppAndVersion.steps.unlockDevice",
} as const);

export type WaitForAppAndVersionDAStateStep =
  (typeof waitForAppAndVersionDAStateStep)[keyof typeof waitForAppAndVersionDAStateStep];

export type WaitForAppAndVersionDAOutput = GetAppAndVersionResponse;

export type WaitForAppAndVersionDAInput = {
  readonly unlockTimeout?: number;
};

export type WaitForAppAndVersionDAError =
  | DeviceLockedError
  | UnknownDAError
  | CommandErrorResult["error"];

export type WaitForAppAndVersionDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice;

export type WaitForAppAndVersionDAIntermediateValue = {
  requiredUserInteraction: WaitForAppAndVersionDARequiredInteraction;
  step: WaitForAppAndVersionDAStateStep;
};

export type WaitForAppAndVersionDAState = DeviceActionState<
  WaitForAppAndVersionDAOutput,
  WaitForAppAndVersionDAError,
  WaitForAppAndVersionDAIntermediateValue
>;
