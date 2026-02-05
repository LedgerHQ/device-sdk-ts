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
  ICON_APP_ERRORS,
  IconAppCommandErrorFactory,
  type IconErrorCodes,
} from "./utils/iconAppErrors";

const CLA = 0xe0;
const INS_SIGN = 0x04;

export type SignTransactionCommandArgs = {
  /**
   * The chunk of data to send
   */
  chunk: Uint8Array;
  /**
   * Whether this is the first chunk
   */
  isFirstChunk: boolean;
};

export type SignTransactionCommandResponse = {
  /**
   * r component (32 bytes)
   */
  r?: Uint8Array;
  /**
   * s component (32 bytes)
   */
  s?: Uint8Array;
  /**
   * v component (1 byte)
   */
  v?: number;
  /**
   * Transaction hash (32 bytes)
   */
  hash?: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, IconErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    IconErrorCodes
  >(ICON_APP_ERRORS, IconAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  /**
   * Maximum chunk size for ICON signing (150 bytes)
   */
  static get CHUNK_SIZE(): number {
    return 150;
  }

  getApdu(): Apdu {
    const { chunk, isFirstChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, IconErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        // Signature response: r (32) + s (32) + v (1) + hash (32) = 97 bytes
        if (responseLength >= 97) {
          const r = parser.extractFieldByLength(32);
          const s = parser.extractFieldByLength(32);
          const v = parser.extract8BitUInt();
          const hash = parser.extractFieldByLength(32);

          if (r === undefined || s === undefined || v === undefined || hash === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          return CommandResultFactory({
            data: { r, s, v, hash },
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
