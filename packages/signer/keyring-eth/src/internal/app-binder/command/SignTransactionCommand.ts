// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-transaction
import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  HexaString,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";
import { Just, Maybe, Nothing } from "purify-ts";

const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignTransactionCommandResponse = Maybe<{
  v: number;
  r: HexaString;
  s: HexaString;
}>;

export type SignTransactionCommandArgs = {
  /**
   * The transaction to sign in max 150 bytes chunks
   */
  readonly serializedTransaction: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
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
    const { serializedTransaction, isFirstChunk } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.addBufferToData(serializedTransaction).build();
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

    // The data is returned only for the last chunk
    const v = parser.extract8BitUInt();
    if (!v) {
      return CommandResultFactory({ data: Nothing });
    }

    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: Just({
        v,
        r,
        s,
      }),
    });
  }
}
