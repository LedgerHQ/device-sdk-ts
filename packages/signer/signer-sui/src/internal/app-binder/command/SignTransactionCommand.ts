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
  SUI_APP_ERRORS,
  SuiAppCommandErrorFactory,
  type SuiErrorCodes,
} from "./utils/suiAppErrors";

const CLA = 0x00;
const INS_SIGN = 0x03;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, SuiErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    SuiErrorCodes
  >(SUI_APP_ERRORS, SuiAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk, isLastChunk } = this._args;

    // P1: 0x00 for first chunk, 0x80 for subsequent chunks
    // P2: 0x00 for more chunks, 0x80 for last chunk
    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: isLastChunk ? 0x80 : 0x00,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, SuiErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        // Ed25519 signature is 64 bytes
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

        // Intermediate chunk - return empty data
        return CommandResultFactory({ data: {} });
      },
    );
  }
}
