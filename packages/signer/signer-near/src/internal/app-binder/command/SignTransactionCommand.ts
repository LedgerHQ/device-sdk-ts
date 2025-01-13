import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import {
  NearAppCommand,
  type NearAppErrorCodes,
} from "@internal/app-binder/command/NearAppCommand";

export type SignTransactionCommandResponse = Maybe<Uint8Array>;

export type SignTransactionCommandArgs = {
  /**
   * The transaction to sign in max 150 bytes chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isLastChunk: boolean;
};

export class SignTransactionCommand extends NearAppCommand<
  SignTransactionCommandResponse,
  SignTransactionCommandArgs
> {
  args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const { data, isLastChunk } = this.args;

    const signTransactionArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x02,
      p1: isLastChunk ? 0x80 : 0x00,
      p2: "W".charCodeAt(0),
    };
    const builder = new ApduBuilder(signTransactionArgs);
    return builder.addBufferToData(data).build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, NearAppErrorCodes> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return this._getError(response, new ApduParser(response));
    }
    if (!this.args.isLastChunk) {
      return CommandResultFactory({
        data: Nothing,
      });
    }
    return CommandResultFactory({
      data: Just(response.data),
    });
  }
}
