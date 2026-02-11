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
  MULTIVERSX_APP_ERRORS,
  MultiversxAppCommandErrorFactory,
  type MultiversxErrorCodes,
} from "./utils/multiversxAppErrors";

const CLA = 0xed;
const INS_SIGN_TX_HASH = 0x07;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, MultiversxErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    MultiversxErrorCodes
  >(MULTIVERSX_APP_ERRORS, MultiversxAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TX_HASH,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, MultiversxErrorCodes> {
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

          return CommandResultFactory({ data: { signature } });
        }

        return CommandResultFactory({ data: {} });
      },
    );
  }
}
