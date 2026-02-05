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
  APTOS_APP_ERRORS,
  AptosAppCommandErrorFactory,
  type AptosErrorCodes,
} from "./utils/aptosAppErrors";

const CLA = 0x5b;
const INS_SIGN_TX = 0x06;

export type SignTransactionCommandArgs = {
  chunk: Uint8Array;
  chunkIndex: number;
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: Uint8Array;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, AptosErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    AptosErrorCodes
  >(APTOS_APP_ERRORS, AptosAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 255;
  }

  getApdu(): Apdu {
    const { chunk, chunkIndex, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TX,
      p1: chunkIndex,
      p2: isLastChunk ? 0x00 : 0x80,
    });

    builder.addBufferToData(chunk);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, AptosErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 0) {
          const signatureLen = parser.extract8BitUInt();
          if (signatureLen === undefined || signatureLen === 0) {
            return CommandResultFactory({ data: {} });
          }

          const signature = parser.extractFieldByLength(signatureLen);
          if (signature === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signature"),
            });
          }

          return CommandResultFactory({ data: { signature } });
        }

        return CommandResultFactory({ data: {} });
      },
    );
  }
}
