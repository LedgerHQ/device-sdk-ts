import { type CommandErrorResult } from "@api/command/model/CommandResult";
import {
  type OpenAppDAError,
  type OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";
import { type Command } from "@api/types";

export type SendCommandInAppDAOutput<CommandResponse> = CommandResponse;

export type SendCommandInAppDAInput<
  CommandResponse,
  CommandArgs,
  CommandErrorCodes,
  UserInteraction,
> = {
  readonly command: Command<CommandResponse, CommandArgs, CommandErrorCodes>;
  readonly appName: string;
  readonly requiredUserInteraction: UserInteraction;
};

export type SendCommandInAppDAError<CommandErrorCodes = void> =
  | OpenAppDAError
  | CommandErrorResult<CommandErrorCodes>["error"];

export type SendCommandInAppDAIntermediateValue<UserInteraction> =
  | { readonly requiredUserInteraction: UserInteraction }
  | OpenAppDAIntermediateValue;

export type SendCommandInAppDAInternalState<
  CommandResponse,
  CommandErrorCodes,
> = {
  readonly commandResponse: CommandResponse | null;
  readonly error: SendCommandInAppDAError<CommandErrorCodes> | null;
};
