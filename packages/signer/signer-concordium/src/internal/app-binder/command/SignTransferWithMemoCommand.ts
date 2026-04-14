import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

export type SignTransferWithMemoCommandArgs = {
  readonly p1: number;
  readonly data: Uint8Array;
};

export type SignTransferWithMemoCommandResponse = Signature;

export class SignTransferWithMemoCommand
  implements
    Command<
      SignTransferWithMemoCommandResponse,
      SignTransferWithMemoCommandArgs,
      ConcordiumErrorCodes
    >
{
  readonly name = "SignTransferWithMemo";

  private readonly args: SignTransferWithMemoCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransferWithMemoCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(args: SignTransferWithMemoCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_TRANSFER_WITH_MEMO,
      p1: this.args.p1,
      p2: P2.NONE,
    });

    apduBuilder.addBufferToData(this.args.data);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransferWithMemoCommandResponse, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const remaining = apduParser.getUnparsedRemainingLength();
      const signature = apduParser.extractFieldByLength(remaining);

      return CommandResultFactory({
        data: signature as Signature,
      });
    });
  }
}
