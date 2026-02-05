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
  STELLAR_APP_ERRORS,
  StellarAppCommandErrorFactory,
  type StellarErrorCodes,
} from "./utils/stellarAppErrors";

const CLA = 0xe0;
const INS_SIGN_TX = 0x04;
const P1_FIRST = 0x00;
const P1_MORE = 0x80;
const P2_LAST = 0x00;
const P2_MORE = 0x80;

export type SignTransactionCommandArgs = {
  chunk: Uint8Array;
  isFirstChunk: boolean;
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, StellarErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    StellarErrorCodes
  >(STELLAR_APP_ERRORS, StellarAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TX,
      p1: isFirstChunk ? P1_FIRST : P1_MORE,
      p2: isLastChunk ? P2_LAST : P2_MORE,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, StellarErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        // Signature is 64 bytes for Ed25519
        if (responseLength >= 64) {
          const signature = parser.extractFieldByLength(64);

          if (signature === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          return CommandResultFactory({
            data: { signature },
          });
        }

        return CommandResultFactory({
          data: {},
        });
      },
    );
  }
}
