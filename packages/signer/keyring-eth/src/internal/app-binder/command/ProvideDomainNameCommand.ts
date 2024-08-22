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
} from "@ledgerhq/device-sdk-core";

export type ProvideDomainNameCommandArgs = {
  /**
   * The chunk of the stringified hexa representation of the domain name prefixed by its length in two bytes.
   * If the index equals 0, the first two bytes are the length of the domain name, else all the bytes are the chunk data.
   * @example "00064C6564676572" (hexa for "Ledger", first chunk and only chunk)
   */
  data: Uint8Array;
  /**
   * The index of the chunk.
   */
  isFirstChunk: boolean;
};

/**
 * The command that provides a chunk of the domain name to the device.
 */
export class ProvideDomainNameCommand
  implements Command<void, ProvideDomainNameCommandArgs>
{
  constructor(private readonly args: ProvideDomainNameCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x22,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void> {
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
