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
 * A single SIGN_PERSONAL_MESSAGE APDU frame.
 *
 * `p1` is the frame position (see {@link SIGN_PERSONAL_MESSAGE_P1}) and
 * `payload` is the bytes for this frame (the derivation path plus the
 * length-prefixed message on the first frame, then raw message chunks). The
 * framing is orchestrated by `SignPersonalMessageTask`. The signature is only
 * returned on the last frame.
 */
export type SignPersonalMessageCommandArgs = {
  readonly payload: Uint8Array;
  readonly p1: number;
};

export type SignPersonalMessageCommandResponse = Signature;

export class SignPersonalMessageCommand
  implements
    Command<
      SignPersonalMessageCommandResponse,
      SignPersonalMessageCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "SignPersonalMessage";

  private readonly _args: SignPersonalMessageCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignPersonalMessageCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: SignPersonalMessageCommandArgs) {
    this._args = args;
  }

  get args(): SignPersonalMessageCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_PERSONAL_MESSAGE,
      p1: this._args.p1,
      p2: P2_NONE,
    })
      .addBufferToData(this._args.payload)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse, TronAppErrorCodes> {
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
