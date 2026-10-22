import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Just, Maybe, Nothing } from "purify-ts";

import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";

import {
  INS,
  P1_MORE_CHUNKS,
  P1_SUBSEQUENT_CHUNK,
  P2_BY_CURVE,
  XRP_CLA,
} from "./utils/apduHeaderUtils";
import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpApplicationErrors";

/**
 * The signature, once the app has one. Non-final chunks are acknowledged with
 * an empty body, which is reported as `Nothing`.
 */
export type SignTransactionCommandResponse = Maybe<Signature>;

export type SignTransactionCommandArgs = {
  /**
   * One chunk of the payload. The first chunk is expected to already carry the
   * encoded derivation path (`[nDerivations][index x n]`) ahead of the
   * transaction bytes — this command writes the chunk as-is and only decides
   * P1 from the flags below.
   */
  readonly chunkedData: Uint8Array;
  readonly isFirstChunk: boolean;
  readonly isLastChunk: boolean;
  /** Curve to sign with. */
  readonly curve: Curve;
};

/**
 * Sends one chunk of a transaction to the XRP application for signing.
 *
 * Chunk-agnostic on purpose: splitting the payload and looping over it belongs
 * to the signing task, so this command only encodes where the chunk sits in
 * the sequence.
 */
export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      XrpErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { chunkedData, isFirstChunk, isLastChunk, curve } = this.args;

    const signTransactionArgs: ApduBuilderArgs = {
      cla: XRP_CLA,
      ins: INS.SIGN,
      // `00` first and last, `80` first with more to come, `81` a middle
      // chunk, `01` the last of several.
      p1:
        (isFirstChunk ? 0x00 : P1_SUBSEQUENT_CHUNK) |
        (isLastChunk ? 0x00 : P1_MORE_CHUNKS),
      // Unlike GetAddress, P2 carries the curve alone — there is no chain code
      // flag on this instruction. The app reads it on the first chunk only;
      // every chunk carries the same value.
      p2: P2_BY_CURVE[curve],
    };

    return new ApduBuilder(signTransactionArgs)
      .addBufferToData(chunkedData)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const length = parser.getUnparsedRemainingLength();

      // Only the final chunk carries a signature; the others are acknowledged
      // with an empty body.
      if (length === 0) {
        return CommandResultFactory({ data: Nothing });
      }

      const signature = parser.extractFieldByLength(length);
      if (signature === undefined) {
        return CommandResultFactory({ data: Nothing });
      }

      // The signature is DER-encoded (secp256k1, variable length) or 64 raw
      // bytes (Ed25519), so it is returned whole. `ApduResponse` already keeps
      // the status word out of the data, so nothing has to be sliced off the
      // end.
      return CommandResultFactory({ data: Just(signature) });
    });
  }
}
