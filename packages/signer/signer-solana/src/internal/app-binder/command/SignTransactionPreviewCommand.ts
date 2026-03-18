import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Just, Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { UserInputType } from "@api/model/TransactionResolutionContext";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const CLA = 0xe0;
export const INS = 0x08;
export const P1 = 0x01;

export const P2 = {
  INIT: 0x00,
  EXTEND: 0x01,
  MORE: 0x02,
  ATA: 0x08,
};

const SIGNATURE_LENGTH = 64;

export type SignTransactionPreviewCommandResponse = Maybe<Signature>;
export type SignTransactionPreviewCommandArgs = {
  readonly serializedTransaction: Uint8Array;
  readonly more: boolean;
  readonly extend: boolean;
  readonly userInputType?: UserInputType;
};

export class SignTransactionPreviewCommand
  implements
    Command<
      SignTransactionPreviewCommandResponse,
      SignTransactionPreviewCommandArgs,
      SolanaAppErrorCodes
    >
{
  readonly name = "signTransactionPreview";
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionPreviewCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: SignTransactionPreviewCommandArgs;

  constructor(args: SignTransactionPreviewCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { more, extend, serializedTransaction, userInputType } = this.args;
    let p2 = P2.INIT;
    if (more) p2 |= P2.MORE;
    if (extend) p2 |= P2.EXTEND;
    if (userInputType === UserInputType.ATA) {
      p2 |= P2.ATA;
    }

    return new ApduBuilder({ cla: CLA, ins: INS, p1: P1, p2 })
      .addBufferToData(serializedTransaction)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionPreviewCommandResponse, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      if (parser.getUnparsedRemainingLength() === 0) {
        return CommandResultFactory({
          data: Nothing,
        });
      }

      const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);
      if (!signature) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is missing"),
        });
      }

      return CommandResultFactory({
        data: Just(signature),
      });
    });
  }
}
