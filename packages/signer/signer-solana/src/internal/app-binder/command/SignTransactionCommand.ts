import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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

const SIGNATURE_LENGTH = 64;

export type SignTransactionCommandResponse = Maybe<Signature>;
export type SignTransactionCommandArgs = {
  /**
   * Chunked serialized transaction
   */
  readonly serializedTransaction: Uint8Array;
  readonly more: boolean;
  readonly extend: boolean;
  readonly userInputType?: UserInputType;
};

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      SolanaAppErrorCodes
    >
{
  readonly name = "signTransaction";
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { more, extend, serializedTransaction, userInputType } = this.args;
    let p2 = 0x00;
    if (more) p2 |= 0x02;
    if (extend) p2 |= 0x01;
    if (userInputType === UserInputType.ata) p2 |= 0x08;

    const signTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x01,
      p2,
    };

    return new ApduBuilder(signTransactionArgs)
      .addBufferToData(serializedTransaction)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, SolanaAppErrorCodes> {
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
