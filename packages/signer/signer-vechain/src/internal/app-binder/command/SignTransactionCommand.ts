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
  VECHAIN_APP_ERRORS,
  VechainAppCommandErrorFactory,
  type VechainErrorCodes,
} from "./utils/vechainAppErrors";

const CLA = 0xe0;
const INS_SIGN_TRANSACTION = 0x04;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, VechainErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    VechainErrorCodes
  >(VECHAIN_APP_ERRORS, VechainAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk } = this._args;

    // P1: 0x00 for first chunk, 0x80 for subsequent chunks
    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TRANSACTION,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, VechainErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        // VeChain signature is 65 bytes (v + r + s)
        if (responseLength >= 65) {
          const signatureBytes = parser.extractFieldByLength(65);
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

        // Intermediate chunk - return empty data
        return CommandResultFactory({ data: {} });
      },
    );
  }
}
