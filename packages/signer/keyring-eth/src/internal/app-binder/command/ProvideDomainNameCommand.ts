// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-domain-name
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-sdk-core";

export type ProvideDomainNameCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
};

/**
 * The length of the payload will take 2 bytes in the APDU.
 */
export const PAYLOAD_LENGTH_BYTES = 2;

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
