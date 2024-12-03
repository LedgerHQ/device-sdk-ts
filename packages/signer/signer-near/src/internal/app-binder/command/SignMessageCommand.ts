import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

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

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs>
{
  args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { data, isLastChunk } = this.args;

    const signNearTransactionArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x07,
      p1: isLastChunk ? 0x80 : 0x00,
      p2: "W".charCodeAt(0),
    };
    const builder = new ApduBuilder(signNearTransactionArgs);
    return builder.addBufferToData(data).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse> {
    // const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
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
