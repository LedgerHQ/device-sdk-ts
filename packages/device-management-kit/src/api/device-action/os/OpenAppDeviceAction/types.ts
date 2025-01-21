import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type OpenAppErrorCodes } from "@api/command/os/OpenAppCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeviceLockedError,
  type DeviceNotOnboardedError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";
import { type GetDeviceStatusDAInput } from "@api/device-action/os/GetDeviceStatus/types";

export type OpenAppDAOutput = void;

export type OpenAppDAInput = GetDeviceStatusDAInput & {
  readonly appName: string;
  readonly compatibleAppNames?: string[];
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
  requiredUserInteraction: OpenAppDARequiredInteraction;
};

export type OpenAppDAState = DeviceActionState<
  OpenAppDAOutput,
  OpenAppDAError,
  OpenAppDAIntermediateValue
>;
