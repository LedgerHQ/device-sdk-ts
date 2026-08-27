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
import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

export type SignPltCommandArgs = {
  readonly p1: number;
  readonly p2: number;
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
 * P2 selects fee display on the INIT frame: `0x00` sends no fee, `0x01` appends
 * an 8-byte big-endian µCCD suffix and the device renders a "Max fees" step.
 * A CONT frame must use `0x00`, and returns 0x6B00 otherwise, so the caller
 * chooses P2 per frame rather than reusing one value for the whole flow.
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
      p2: this.args.p2,
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
