// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-external-plugin
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  type CommandErrorArgs,
  type CommandErrors,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-sdk-core";

type SetExternalPluginCommandArgs = {
  payload: string;
  signature?: string;
};

export type SetExternalPluginCommandErrorCodes = "6a80" | "6984" | "6d00";

const SET_EXTERNAL_PLUGIN_ERRORS: CommandErrors<SetExternalPluginCommandErrorCodes> =
  {
    "6a80": { message: "Invalid plugin name size" },
    "6984": { message: "Plugin not installed on device" },
    "6d00": { message: "Version of Eth app not supported" },
  };

export class SetExternalPluginCommandError extends DeviceExchangeError<SetExternalPluginCommandErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<SetExternalPluginCommandErrorCodes>) {
    super({ tag: "SetExternalPluginCommandError", message, errorCode });
  }
}

export class SetExternalPluginCommand
  implements
    Command<
      void,
      SetExternalPluginCommandArgs,
      SetExternalPluginCommandErrorCodes
    >
{
  constructor(private readonly args: SetExternalPluginCommandArgs) {}

  getApdu(): Apdu {
    const setExternalPluginBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x12,
      p1: 0x00,
      p2: 0x00,
    };
    return (
      new ApduBuilder(setExternalPluginBuilderArgs)
        .addHexaStringToData(this.args.payload)
        /**
         * The signature is normally integrated in the payload, but keeping this step for safety reasons and will be removed in the future.
         */
        .addHexaStringToData(this.args.signature ?? "")
        .build()
    );
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, SetExternalPluginCommandErrorCodes> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({ data: undefined });
    }

    const parser = new ApduParser(apduResponse);
    const statusCodeHex = parser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(statusCodeHex, SET_EXTERNAL_PLUGIN_ERRORS)) {
      return CommandResultFactory({
        error: new SetExternalPluginCommandError({
          ...SET_EXTERNAL_PLUGIN_ERRORS[statusCodeHex],
          errorCode: statusCodeHex,
        }),
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
