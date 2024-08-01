// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-domain-name
import {
  Apdu,
  ApduBuilder,
  ApduParser,
  ApduResponse,
  type Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

export type ProvideDomainNameCommandArgs = {
  /**
   * The stringified hexa representation of the domain name.
   * @example "4C6564676572" (hexa for "Ledger")
   */
  data: string;
  /**
   * The index of the chunk.
   */
  index: number;
};

/**
 * The command that provides a chunk of the domain name to the device.
 */
export class ProvideDomainNameCommand implements Command<void, void> {
  constructor(private args: ProvideDomainNameCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs = {
      cla: 0xe0,
      ins: 0x22,
      p1: this.args.index === 0 ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): void {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }
  }
}
