// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-external-plugin

import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  Command,
  CommandErrorArgs,
  CommandErrors,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-sdk-core";

type SetExternalPluginCommandArgs = {
  payload: Uint8Array;
  signature: Uint8Array;
};

type SetExternalPluginCommandErrorCodes = "6a80" | "6984" | "6d00";

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
  implements Command<void, SetExternalPluginCommandArgs>
{
  constructor(private readonly args: SetExternalPluginCommandArgs) {}

  getApdu(): Apdu {
    const { payload, signature } = this.args;
    const setExternalPluginBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x12,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(setExternalPluginBuilderArgs);
    builder.addBufferToData(payload);
    builder.addBufferToData(signature);

    return builder.build();
  }

  parseResponse(apduResponse: ApduResponse): CommandResult<void> {
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
