// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-external-plugin

import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

type SetExternalPluginCommandArgs = {
  payload: Uint8Array;
  signature: Uint8Array;
};

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

  parseResponse(apduResponse: ApduResponse): void {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return;
    }

    const parser = new ApduParser(apduResponse);
    const statusCodeHex = parser.encodeToHexaString(apduResponse.statusCode);

    switch (statusCodeHex) {
      case "6a80":
        throw new InvalidStatusWordError("Invalid plugin name size");
      case "6984":
        throw new InvalidStatusWordError("Plugin not installed on device");
      case "6d00":
        throw new InvalidStatusWordError("Version of Eth app not supported");
      default:
        throw new InvalidStatusWordError(
          `Unexpected status word: ${parser.encodeToHexaString(
            apduResponse.statusCode,
          )}`,
        );
    }
  }
}
