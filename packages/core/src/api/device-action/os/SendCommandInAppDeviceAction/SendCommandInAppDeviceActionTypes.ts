import { CommandResult } from "@api/command/model/CommandResult";
import {
  OpenAppDAError,
  OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";
import { SdkError } from "@api/Error";
import { Command } from "@api/types";

export type SendCommandInAppDAOutput<CommandResponse> = CommandResponse;

export type SendCommandInAppDAInput<
  CommandResponse,
  CommandArgs,
  UserInteraction,
  CommandErrorCodes,
> = {
  readonly command: Command<CommandResponse, CommandErrorCodes, CommandArgs>;
  readonly appName: string;
  readonly requiredUserInteraction: UserInteraction;
};

export type SendCommandInAppDAError<CommandError extends SdkError> =
  | OpenAppDAError
  | CommandError;

export type SendCommandInAppDAIntermediateValue<UserInteraction> =
  | { readonly requiredUserInteraction: UserInteraction }
  | OpenAppDAIntermediateValue;

export type SendCommandInAppDAInternalState<
  CommandResponse,
  CommandErrorCodes,
  CommandError,
> = {
  readonly commandResponse: CommandResult<
    CommandResponse,
    CommandErrorCodes
  > | null;
  readonly error: OpenAppDAError | CommandError | null;
};
