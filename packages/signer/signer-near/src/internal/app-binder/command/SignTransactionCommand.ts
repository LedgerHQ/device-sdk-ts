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
  NEAR_APP_ERRORS,
  NearAppCommandErrorFactory,
  type NearErrorCodes,
} from "./utils/nearAppErrors";

// NEAR APDU constants
const CLA = 0x80;
const INS_SIGN = 0x02;
const P1_LAST_CHUNK = 0x80;
const NETWORK_ID = 0x57; // 'W'

export type SignTransactionCommandArgs = {
  /**
   * The chunk of data to send
   */
  chunk: Uint8Array;
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
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, NearErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    NearErrorCodes
  >(NEAR_APP_ERRORS, NearAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  /**
   * Maximum chunk size for NEAR signing (255 bytes)
   */
  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { chunk, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1: isLastChunk ? P1_LAST_CHUNK : 0x00,
      p2: NETWORK_ID,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, NearErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // If we have data, it's the signature (64 bytes for Ed25519)
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 64) {
          const signature = parser.extractFieldByLength(64);

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
