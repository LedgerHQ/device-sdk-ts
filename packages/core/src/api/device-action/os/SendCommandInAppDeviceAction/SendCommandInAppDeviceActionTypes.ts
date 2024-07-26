import {
  OpenAppDAError,
  OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";
import { SdkError } from "@api/Error";
import { Command } from "@api/types";

export type SendCommandInAppDAOutput<CommandResult> = CommandResult;

export type SendCommandInAppDAInput<
  CommandResult,
  CommandArgs,
  UserInteraction,
> = {
  readonly command: Command<CommandResult, CommandArgs>;
  readonly appName: string;
  readonly requiredUserInteraction: UserInteraction;
};

export type SendCommandInAppDAError<CommandError extends SdkError> =
  | OpenAppDAError
  | CommandError;

export type SendCommandInAppDAIntermediateValue<UserInteraction> =
  | { readonly requiredUserInteraction: UserInteraction }
  | OpenAppDAIntermediateValue;

export type SendCommandInAppDAInternalState<CommandResult, CommandError> = {
  readonly commandResponse: CommandResult | null;
  readonly error: OpenAppDAError | CommandError | null;
};
