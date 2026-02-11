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
import { Maybe } from "purify-ts";

import {
  CANTON_APP_ERRORS,
  CantonAppCommandErrorFactory,
  type CantonErrorCodes,
} from "./utils/cantonAppErrors";

const CLA = 0xe0;
const INS_SIGN = 0x06;
const P2_FIRST = 0x01;
const P2_MORE = 0x02;
const P2_MSG_END = 0x04;

export type SignTransactionCommandArgs = {
  chunk: Uint8Array;
  p1: number;
  isFirstChunk: boolean;
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, CantonErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    CantonErrorCodes
  >(CANTON_APP_ERRORS, CantonAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { chunk, p1, isFirstChunk, isLastChunk } = this._args;

    // P2 calculation based on Canton protocol:
    // First chunk: P2_FIRST | P2_MORE (0x03)
    // Middle chunks: P2_MORE (0x02)
    // Last chunk: P2_MSG_END (0x04)
    // Only chunk: P2_FIRST | P2_MSG_END (0x05)
    let p2: number;
    if (isFirstChunk && isLastChunk) {
      p2 = P2_FIRST | P2_MSG_END; // 0x05 - single chunk
    } else if (isFirstChunk) {
      p2 = P2_FIRST | P2_MORE; // 0x03 - first of multiple
    } else if (isLastChunk) {
      p2 = P2_MSG_END; // 0x04 - last chunk
    } else {
      p2 = P2_MORE; // 0x02 - middle chunk
    }

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1: p1,
      p2: p2,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, CantonErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 0) {
          const signatureBytes = parser.extractFieldByLength(responseLength);
          if (signatureBytes === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          let signature = Array.from(signatureBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // Handle Canton-framed signature (starts with 0x40 and ends with 0x00)
          if (signature.length === 132 && signature.startsWith("40") && signature.endsWith("00")) {
            signature = signature.slice(2, -2);
          }

          return CommandResultFactory({ data: { signature } });
        }

        return CommandResultFactory({ data: {} });
      },
    );
  }
}
