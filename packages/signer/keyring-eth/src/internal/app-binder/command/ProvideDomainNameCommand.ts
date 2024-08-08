// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-domain-name
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  GlobalCommandErrorStatusCode,
} from "@ledgerhq/device-sdk-core";

export type ProvideDomainNameCommandArgs = {
  /**
   * The chunk of the stringified hexa representation of the domain name prefixed by its length in two bytes.
   * If the index equals 0, the first two bytes are the length of the domain name, else all the bytes are the chunk data.
   * @example "00064C6564676572" (hexa for "Ledger", first chunk and only chunk)
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
export class ProvideDomainNameCommand
  implements
    Command<void, GlobalCommandErrorStatusCode, ProvideDomainNameCommandArgs>
{
  constructor(private args: ProvideDomainNameCommandArgs) {}

  getApdu(): Apdu {
    const isFirstChunk = this.args.index === 0;
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x22,
      p1: isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, GlobalCommandErrorStatusCode> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    return CommandResultFactory({
      data: undefined,
    });
  }
}
