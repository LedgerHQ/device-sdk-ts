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

export type SignMessageCommandResponse = Maybe<Uint8Array>;

export type SignMessageCommandArgs = {
  /**
   * The transaction to sign in max 150 bytes chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isLastChunk: boolean;
};

export class SignMessageCommand extends NearAppCommand<
  SignMessageCommandResponse,
  SignMessageCommandArgs
> {
  args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const { data, isLastChunk } = this.args;

    const signMessageArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x07,
      p1: isLastChunk ? 0x80 : 0x00,
      p2: "W".charCodeAt(0),
    };
    const builder = new ApduBuilder(signMessageArgs);
    return builder.addBufferToData(data).build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, NearAppErrorCodes> {
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
