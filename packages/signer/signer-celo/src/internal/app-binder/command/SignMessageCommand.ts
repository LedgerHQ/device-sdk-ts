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
  CELO_APP_ERRORS,
  CeloAppCommandErrorFactory,
  type CeloErrorCodes,
} from "./utils/celoAppErrors";

const CLA = 0xe0;
const INS_SIGN_MESSAGE = 0x08;

export type SignMessageCommandArgs = {
  chunk: Uint8Array;
  isFirstChunk: boolean;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs, CeloErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    CeloErrorCodes
  >(CELO_APP_ERRORS, CeloAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
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
  ): CommandResult<SignMessageCommandResponse, CeloErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 65) {
          // Full signature response: v (1 byte) + r (32 bytes) + s (32 bytes)
          const v = parser.extract8BitUInt();
          const rBytes = parser.extractFieldByLength(32);
          const sBytes = parser.extractFieldByLength(32);

          if (v === undefined || rBytes === undefined || sBytes === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature components"),
            });
          }

          const r = Array.from(rBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const s = Array.from(sBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          return CommandResultFactory({ data: { v, r, s } });
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid signature response"),
        });
      },
    );
  }
}
