import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";

const SIGNATURE_LENGTH = 64;

export type SignTransactionCommandResponse = Maybe<Signature>;
export type SignTransactionCommandArgs = {
  /**
   * Chunked serialized transaction
   */
  readonly serializedTransaction: Uint8Array;
  readonly more: boolean;
  readonly extend: boolean;
};

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs>
{
  args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { more, extend, serializedTransaction } = this.args;
    let p2 = 0x00;
    if (more) p2 |= 0x02;
    if (extend) p2 |= 0x01;

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
  ): CommandResult<SignTransactionCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

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
  }
}
