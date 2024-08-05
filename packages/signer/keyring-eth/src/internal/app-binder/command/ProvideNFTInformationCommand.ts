// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-nft-information
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

export type ProvideNFTInformationCommandArgs = {
  /**
   * The stringified hexa representation of the NFT data.
   */
  data: string;
};

export class ProvideNFTInformationCommand
  implements Command<void, ProvideNFTInformationCommandArgs>
{
  constructor(private args: ProvideNFTInformationCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x14,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): void {
    const parser = new ApduParser(response);

    if (response.statusCode[0] === 0x6d && response.statusCode[1] === 0x00) {
      // This is temporary, a new error class should be created to handle this case later.
      throw new InvalidStatusWordError("ETH app is not up to date");
    }

    if (!CommandUtils.isSuccessResponse(response)) {
      // TODO: handle the error correctly using a generic error handler
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }
  }
}
