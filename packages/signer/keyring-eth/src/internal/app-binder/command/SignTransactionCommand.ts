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

import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const MAX_CHUNK_SIZE = 150;
const PATH_SIZE = 4;
const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignTransactionCommandResponse = Maybe<{
  v: number;
  r: HexaString;
  s: HexaString;
}>;

export type SignTransactionCommandArgs = {
  /**
   * The derivation path to use to sign the transaction.
   */
  derivationPath: string;

  /**
   * The complete serialized transaction data.
   */
  data: Uint8Array;

  /**
   * The index of the chunk to sign.
   */
  index: number;
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
    const { data, derivationPath, index } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: index === 0 ? 0x00 : 0x80,
      p2: 0x00,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    const path = DerivationPathUtils.splitPath(derivationPath);
    const dataFirstChunkIndex = MAX_CHUNK_SIZE - path.length * PATH_SIZE - 1;

    if (index === 0) {
      // add derivation path to the first packet
      builder.add8BitUIntToData(path.length);
      path.forEach((element) => {
        builder.add32BitUIntToData(element);
      });

      // add 150 bytes of data minus the path length and the path
      builder.addBufferToData(data.slice(0, dataFirstChunkIndex));
    } else {
      // add 150 bytes of data starting from the second packet
      builder.addBufferToData(
        data.slice(
          dataFirstChunkIndex + (index - 1) * MAX_CHUNK_SIZE,
          dataFirstChunkIndex + index * MAX_CHUNK_SIZE,
        ),
      );
    }

    return builder.build();
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
