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
  MULTIVERSX_APP_ERRORS,
  MultiversxAppCommandErrorFactory,
  type MultiversxErrorCodes,
} from "./utils/multiversxAppErrors";

const CLA = 0xed;
const INS_SIGN_MSG = 0x06;

export type SignMessageCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs, MultiversxErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    MultiversxErrorCodes
  >(MULTIVERSX_APP_ERRORS, MultiversxAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_MSG,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, MultiversxErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 64) {
          const signatureBytes = parser.extractFieldByLength(64);
          if (signatureBytes === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          const signature = Array.from(signatureBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          return CommandResultFactory({
            data: { r: signature, s: "", v: undefined },
          });
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid signature response"),
        });
      },
    );
  }
}
