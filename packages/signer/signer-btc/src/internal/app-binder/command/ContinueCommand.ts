import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BtcCommand } from "@internal/app-binder/command/utils/BtcCommand";

export type ContinueCommandArgs = {
  payload: Uint8Array;
};

export type ContinueCommandResponse = ApduResponse;

export class ContinueCommand extends BtcCommand<
  ContinueCommandResponse,
  ContinueCommandArgs
> {
  constructor(private readonly args: ContinueCommandArgs) {
    super();
  }

  override getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xf8,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<ContinueCommandResponse, BitcoinAppErrorCodes> {
    return this._getError(response).orDefault(
      CommandResultFactory({
        data: response,
      }),
    );
  }
}
