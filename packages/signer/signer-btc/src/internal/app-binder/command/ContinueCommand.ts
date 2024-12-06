// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_extended_pubkey
import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

import { CommandUtils } from "@internal/utils/CommandUtils";

export type ContinueCommandArgs = {
  payload: Uint8Array;
};

export class ContinueCommand
  implements Command<Uint8Array, ContinueCommandArgs>
{
  constructor(private readonly args: ContinueCommandArgs) {}
  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xf8,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<Uint8Array> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    return CommandResultFactory({
      data: response.data,
    });
  }
}
