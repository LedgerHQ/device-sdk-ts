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

// const R_LENGTH = 32;
// const S_LENGTH = 32;

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

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs>
{
  args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { data, isLastChunk } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x02,
      p1: isLastChunk ? 0x80 : 0x00,
      p2: "W".charCodeAt(0),
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.addBufferToData(data).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse> {
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

    // // The data is returned only for the last chunk
    // const v = parser.extract8BitUInt();
    // if (v === undefined) {
    //   return CommandResultFactory({ data: Nothing });
    // }
    //
    // const r = parser.encodeToHexaString(
    //   parser.extractFieldByLength(R_LENGTH),
    //   true,
    // );
    // if (!r) {
    //   return CommandResultFactory({
    //     error: new InvalidStatusWordError("R is missing"),
    //   });
    // }
    //
    // const s = parser.encodeToHexaString(
    //   parser.extractFieldByLength(S_LENGTH),
    //   true,
    // );
    // if (!s) {
    //   return CommandResultFactory({
    //     error: new InvalidStatusWordError("S is missing"),
    //   });
    // }
    //
    // return CommandResultFactory({
    //   data: Just({
    //     v,
    //     r,
    //     s,
    //   }),
    // });
  }
}
