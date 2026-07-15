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
import { INS, LEDGER_CLA, P2_NONE } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronAppErrorCodes,
} from "./utils/tronApplicationErrors";

/**
 * A single SIGN_TRANSACTION APDU frame.
 *
 * The Tron app frames a transaction across multiple APDUs; `p1` is the frame's
 * "start byte" (see {@link SIGN_TRANSACTION_P1}) and `payload` is the bytes for
 * this frame (the derivation path on the first frame, then transaction chunks).
 * The framing itself is orchestrated by `SignTransactionTask`. The signature is
 * only returned on the last frame.
 */
export type SignTransactionCommandArgs = {
  readonly payload: Uint8Array;
  readonly p1: number;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  get args(): SignTransactionCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_TRANSACTION,
      p1: this._args.p1,
      p2: P2_NONE,
    })
      .addBufferToData(this._args.payload)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, TronAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      // The signature (r[32] + s[32] + v[1]) is present only on the final
      // frame; intermediate frames return an empty payload.
      const remaining = parser.getUnparsedRemainingLength();
      const signature =
        parser.extractFieldByLength(remaining) ?? new Uint8Array();

      return CommandResultFactory({ data: signature });
    });
  }
}
