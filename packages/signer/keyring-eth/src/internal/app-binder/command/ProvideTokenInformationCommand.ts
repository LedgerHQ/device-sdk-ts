// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-erc-20-token-information
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

export type ProvideTokenInformationCommandArgs = {
  payload: string;
};

export type ProvideTokenInformationCommandResponse = {
  tokenIndex: number;
};

export class ProvideTokenInformationCommand
  implements
    Command<
      ProvideTokenInformationCommandResponse,
      ProvideTokenInformationCommandArgs
    >
{
  args: ProvideTokenInformationCommandArgs;

  constructor(args: ProvideTokenInformationCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getEthAddressArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x0a,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getEthAddressArgs);
    builder.addHexaStringToData(this.args.payload);
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): ProvideTokenInformationCommandResponse {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }

    const tokenIndex = parser.extract8BitUInt();
    if (tokenIndex === undefined) {
      throw new InvalidStatusWordError("tokenIndex is missing");
    }

    return { tokenIndex };
  }
}
