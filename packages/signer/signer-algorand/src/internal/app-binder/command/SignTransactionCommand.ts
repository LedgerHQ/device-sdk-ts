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
  ALGORAND_APP_ERRORS,
  AlgorandAppCommandErrorFactory,
  type AlgorandErrorCodes,
} from "./utils/algorandAppErrors";

// Algorand APDU constants
const CLA = 0x80;
const INS_SIGN_MSGPACK = 0x08;
const P1_WITH_ACCOUNT_ID = 0x01;
const P1_MORE = 0x80;
const P2_LAST = 0x00;
const P2_MORE = 0x80;

export type SignTransactionCommandArgs = {
  /**
   * The chunk of data to send
   */
  chunk: Uint8Array;
  /**
   * Whether this is the first chunk (includes account ID)
   */
  isFirstChunk: boolean;
  /**
   * Whether this is the last chunk
   */
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  /**
   * Signature bytes (64 bytes for Ed25519)
   * Only present in the response to the last chunk
   */
  signature?: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, AlgorandErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    AlgorandErrorCodes
  >(ALGORAND_APP_ERRORS, AlgorandAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  /**
   * Maximum chunk size for Algorand signing (250 bytes)
   */
  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_MSGPACK,
      p1: isFirstChunk ? P1_WITH_ACCOUNT_ID : P1_MORE,
      p2: isLastChunk ? P2_LAST : P2_MORE,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, AlgorandErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // If we have data in the response, it's the signature (64 bytes for Ed25519)
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 0) {
          const signature = parser.extractFieldByLength(responseLength);

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
