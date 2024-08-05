// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-plugin
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

export type SetPluginCommandArgs = {
  /**
   * The stringified hexa representation of the plugin signature.
   */
  data: string;
};

export class SetPluginCommand implements Command<void, SetPluginCommandArgs> {
  constructor(private args: SetPluginCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x16,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): void {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler. These error status codes come from the LL implementation, just for backup for now.
    if (!CommandUtils.isSuccessResponse(response)) {
      if (response.statusCode[0] === 0x6a && response.statusCode[1] === 0x80) {
        throw new InvalidStatusWordError(
          "The plugin name is too short or too long",
        );
      } else if (
        response.statusCode[0] === 0x69 &&
        response.statusCode[1] === 0x84
      ) {
        throw new InvalidStatusWordError(
          "the requested plugin is not installed on the device",
        );
      } else if (
        response.statusCode[0] === 0x6d &&
        response.statusCode[1] === 0x00
      ) {
        throw new InvalidStatusWordError("ETH app is not up to date");
      } else {
        throw new InvalidStatusWordError(
          `Unexpected status word: ${parser.encodeToHexaString(
            response.statusCode,
          )}`,
        );
      }
    }
  }
}
