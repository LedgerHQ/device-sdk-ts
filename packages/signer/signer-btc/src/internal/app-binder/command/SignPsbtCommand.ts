import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BtcCommand } from "@internal/app-binder/command/utils/BtcCommand";
import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";

export type SignPsbtCommandArgs = {
  globalCommitments: Uint8Array;
  inputsCommitments: Uint8Array;
  outputsCommitments: Uint8Array;
  walletId: Uint8Array;
  walletHmac: Uint8Array;
};

type SignPsbtCommandResponse = ApduResponse;

export class SignPsbtCommand extends BtcCommand<
  SignPsbtCommandResponse,
  SignPsbtCommandArgs
> {
  constructor(private _args: SignPsbtCommandArgs) {
    super();
  }

  override getApdu(): Apdu {
    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x04,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    });
    const {
      globalCommitments,
      inputsCommitments,
      outputsCommitments,
      walletHmac,
      walletId,
    } = this._args;

    return builder
      .addBufferToData(globalCommitments)
      .addBufferToData(inputsCommitments)
      .addBufferToData(outputsCommitments)
      .addBufferToData(walletId)
      .addBufferToData(walletHmac)
      .build();
  }
  override parseResponse(
    response: ApduResponse,
  ): CommandResult<SignPsbtCommandResponse, BitcoinAppErrorCodes> {
    return this._getError(response).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
