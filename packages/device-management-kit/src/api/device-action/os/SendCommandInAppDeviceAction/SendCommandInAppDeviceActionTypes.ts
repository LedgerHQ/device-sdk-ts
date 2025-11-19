import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";
import { type Command } from "@api/types";

export const sendCommandInAppDAStateStep = Object.freeze({
  OPEN_APP: "os.sendCommandInApp.steps.openApp",
  SEND_COMMAND: "os.sendCommandInApp.steps.sendCommand",
} as const);

export type SendCommandInAppDAStateStep =
  (typeof sendCommandInAppDAStateStep)[keyof typeof sendCommandInAppDAStateStep];

export type SendCommandInAppDAOutput<CommandResponse> = CommandResponse;

export type SendCommandInAppDAInput<
  CommandResponse,
  CommandArgs,
  CommandErrorCodes,
  UserInteraction,
> = {
  readonly command: Command<CommandResponse, CommandArgs, CommandErrorCodes>;
  readonly appName: string;
  readonly skipOpenApp: boolean;
  readonly requiredUserInteraction: UserInteraction;
};

export type SendCommandInAppDAError<CommandErrorCodes = void> =
  | OpenAppDAError
  | CommandErrorResult<CommandErrorCodes>["error"];

export type SendCommandInAppDARequiredInteraction =
  UserInteractionRequired.None;

export type SendCommandInAppDAIntermediateValue<UserInteraction> =
  | {
      readonly requiredUserInteraction:
        | UserInteraction
        | SendCommandInAppDARequiredInteraction;
      readonly step: SendCommandInAppDAStateStep;
    }
  | OpenAppDAIntermediateValue;

export type SendCommandInAppDAInternalState<
  CommandResponse,
  CommandErrorCodes,
> = {
  readonly commandResponse: CommandResponse | null;
  readonly error: SendCommandInAppDAError<CommandErrorCodes> | null;
};
