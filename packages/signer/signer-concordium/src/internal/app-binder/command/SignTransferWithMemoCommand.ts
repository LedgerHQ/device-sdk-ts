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
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";
import { encodeDisplayFee } from "@internal/app-binder/utils/FeeDisplay";

export type SignTransferWithMemoCommandArgs = {
  readonly p1: number;
  readonly data: Uint8Array;
  /**
   * When set AND `p1 === P1.INITIAL_WITH_MEMO`, the APDU is built with
   * P2=FEE_DISPLAY and 8 big-endian fee bytes are appended to `data` so the
   * device can show the fee to the user. Ignored for memo and amount steps
   * (fee bytes are only carried on the initial APDU).
   */
  readonly displayFeeMicroCcd?: bigint;
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
    const useFeeDisplay =
      this.args.p1 === P1.INITIAL_WITH_MEMO &&
      this.args.displayFeeMicroCcd !== undefined;

    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_TRANSFER_WITH_MEMO,
      p1: this.args.p1,
      p2: useFeeDisplay ? P2.FEE_DISPLAY : P2.NONE,
    });

    apduBuilder.addBufferToData(this.args.data);

    if (useFeeDisplay) {
      // Fee bytes are appended to the APDU for on-device display only —
      // they are NOT part of the transaction payload the device hashes.
      apduBuilder.addBufferToData(
        encodeDisplayFee(this.args.displayFeeMicroCcd!),
      );
    }

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
