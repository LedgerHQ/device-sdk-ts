// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-plugin
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandErrorArgs,
  type CommandErrors,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

export type SetPluginCommandErrorCodes = "6984" | "6d00";

const SET_PLUGIN_ERRORS: CommandErrors<SetPluginCommandErrorCodes> = {
  "6984": { message: "The requested plugin is not installed on the device" },
  "6d00": { message: "ETH app is not up to date" },
};

export type SetPluginCommandArgs = {
  /**
   * The stringified hexa representation of the plugin signature.
   */
  payload: string;
};

export class SetPluginCommandError extends DeviceExchangeError<SetPluginCommandErrorCodes> {
  constructor(args: CommandErrorArgs<SetPluginCommandErrorCodes>) {
    super({ ...args, tag: "SetPluginCommandError" });
  }
}

export class SetPluginCommand
  implements Command<void, SetPluginCommandArgs, SetPluginCommandErrorCodes>
{
  constructor(private readonly args: SetPluginCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x16,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SetPluginCommandErrorCodes> {
    if (CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({ data: undefined });
    }
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);

    if (isCommandErrorCode(errorCode, SET_PLUGIN_ERRORS)) {
      return CommandResultFactory({
        error: new SetPluginCommandError({
          ...SET_PLUGIN_ERRORS[errorCode],
          errorCode,
        }),
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(response),
    });
  }
}
