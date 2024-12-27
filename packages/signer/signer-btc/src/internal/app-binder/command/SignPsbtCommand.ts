import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

export type SignPsbtCommandArgs = {
  globalCommitments: Uint8Array;
  inputsCommitments: Uint8Array;
  outputsCommitments: Uint8Array;
  walletId: Uint8Array;
  walletHmac: Uint8Array;
};

type SignPsbtCommandResponse = ApduResponse;

export class SignPsbtCommand
  implements
    Command<SignPsbtCommandResponse, SignPsbtCommandArgs, BtcErrorCodes>
{
  constructor(
    private readonly _args: SignPsbtCommandArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      SignPsbtCommandResponse,
      BtcErrorCodes
    >(
      BTC_APP_ERRORS,
      BtcAppCommandErrorFactory,
      BtcCommandUtils.isSuccessResponse,
    ),
  ) {}

  getApdu(): Apdu {
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
  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignPsbtCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(this._errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
