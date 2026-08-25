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

export type SignPltCommandArgs = {
  readonly p1: number;
  readonly data: Uint8Array;
};

/**
 * Empty for the INIT frame and every intermediate CONT frame; the 64-byte
 * Ed25519 signature on the final CONT frame.
 */
export type SignPltCommandResponse = Signature;

/**
 * PLT (Protocol Level Token) signing, INS 0x27.
 *
 * P2 is fixed at 0x00 — the handler returns 0x6B00 for any other value, so it
 * is not exposed as an argument. The PLT review screens display no fee, so the
 * fee-display extension used by the CCD signing paths does not apply here.
 */
export class SignPltCommand
  implements
    Command<SignPltCommandResponse, SignPltCommandArgs, ConcordiumErrorCodes>
{
  readonly name = "SignPlt";

  private readonly args: SignPltCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignPltCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(args: SignPltCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_PLT,
      p1: this.args.p1,
      p2: P2.NONE,
    });

    apduBuilder.addBufferToData(this.args.data);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPltCommandResponse, ConcordiumErrorCodes> {
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
