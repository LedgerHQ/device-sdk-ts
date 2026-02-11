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

import { type Signature } from "@api/model/Signature";
import {
  STELLAR_APP_ERRORS,
  StellarAppCommandErrorFactory,
  type StellarErrorCodes,
} from "./utils/stellarAppErrors";

const CLA = 0xe0;
const INS_SIGN_MESSAGE = 0x0c;
const P1_FIRST = 0x00;
const P1_MORE = 0x80;
const P2_LAST = 0x00;
const P2_MORE = 0x80;

export type SignMessageCommandArgs = {
  chunk: Uint8Array;
  isFirstChunk: boolean;
  isLastChunk: boolean;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, StellarErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    StellarErrorCodes
  >(STELLAR_APP_ERRORS, StellarAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_MESSAGE,
      p1: isFirstChunk ? P1_FIRST : P1_MORE,
      p2: isLastChunk ? P2_LAST : P2_MORE,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, StellarErrorCodes> {
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

          const signatureHex = Array.from(signature)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          return CommandResultFactory({
            data: {
              r: signatureHex,
              s: "",
              v: undefined,
            },
          });
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Incomplete signature response"),
        });
      },
    );
  }
}
