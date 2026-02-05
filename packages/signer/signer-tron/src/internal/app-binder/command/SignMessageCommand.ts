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
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronAppErrors";

// Tron APDU constants
const CLA = 0xe0;
const INS_SIGN_MESSAGE = 0x08;

export type SignMessageCommandArgs = {
  /**
   * The chunk of message data to send
   */
  chunk: Uint8Array;
  /**
   * Whether this is the first chunk
   */
  isFirstChunk: boolean;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, TronErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  /**
   * Maximum chunk size for Tron message signing (250 bytes)
   */
  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_MESSAGE,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Signature is 65 bytes
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 65) {
          const signature = parser.extractFieldByLength(65);

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

        // Intermediate chunk - no signature yet
        return CommandResultFactory({
          error: new InvalidStatusWordError("Incomplete signature response"),
        });
      },
    );
  }
}
