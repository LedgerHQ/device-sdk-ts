import { CommandErrorResult } from "@api/command/model/CommandResult";
import { OpenAppErrorCodes } from "@api/command/os/OpenAppCommand";
import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";

export type OpenAppDAOutput = void;

export type OpenAppDAInput = {
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
  requiredUserInteraction: OpenAppDARequiredInteraction;
};

export type OpenAppDAState = DeviceActionState<
  OpenAppDAOutput,
  OpenAppDAError,
  OpenAppDAIntermediateValue
>;
