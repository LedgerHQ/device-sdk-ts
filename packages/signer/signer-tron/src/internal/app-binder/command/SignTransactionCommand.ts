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
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronAppErrors";

// Tron APDU constants
const CLA = 0xe0;
const INS_SIGN = 0x04;

// P1 flags for chunking
const P1_FIRST = 0x00;
const P1_MORE = 0x80;
const P1_SINGLE = 0x10;
const P1_LAST = 0x90;

export type SignTransactionCommandArgs = {
  /**
   * The chunk of data to send
   */
  chunk: Uint8Array;
  /**
   * Whether this is the first chunk
   */
  isFirstChunk: boolean;
  /**
   * Whether this is the last chunk
   */
  isLastChunk: boolean;
  /**
   * Whether there's only one chunk (single packet)
   */
  isSingleChunk: boolean;
};

export type SignTransactionCommandResponse = {
  /**
   * Signature bytes (65 bytes)
   * Only present in the response to the last chunk
   */
  signature?: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, TronErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  /**
   * Maximum chunk size for Tron signing (250 bytes)
   */
  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk, isLastChunk, isSingleChunk } = this._args;

    let p1: number;
    if (isSingleChunk) {
      p1 = P1_SINGLE;
    } else if (isFirstChunk) {
      p1 = P1_FIRST;
    } else if (isLastChunk) {
      p1 = P1_LAST;
    } else {
      p1 = P1_MORE;
    }

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1,
      p2: 0x00,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // If we have data in the response, it's the signature (65 bytes)
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 65) {
          const signature = parser.extractFieldByLength(65);

          if (signature === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          return CommandResultFactory({
            data: {
              signature,
            },
          });
        }

        // No signature yet (intermediate chunk)
        return CommandResultFactory({
          data: {},
        });
      },
    );
  }
}
