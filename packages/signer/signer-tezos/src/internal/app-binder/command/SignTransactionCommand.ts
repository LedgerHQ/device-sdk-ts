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
  TEZOS_APP_ERRORS,
  TezosAppCommandErrorFactory,
  TezosCurve,
  type TezosErrorCodes,
} from "./utils/tezosAppErrors";

const CLA = 0x80;
const INS_SIGN = 0x04;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
  isLastChunk: boolean;
  curve?: TezosCurve;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, TezosErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    TezosErrorCodes
  >(TEZOS_APP_ERRORS, TezosAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 230;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk, isLastChunk, curve = TezosCurve.ED25519 } = this._args;

    // P1: 0x00 for first chunk, 0x01 for middle chunks, 0x81 for last chunk
    let p1: number;
    if (isFirstChunk) {
      p1 = 0x00;
    } else if (isLastChunk) {
      p1 = 0x81;
    } else {
      p1 = 0x01;
    }

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN,
      p1,
      p2: curve,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, TezosErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 0) {
          const signatureBytes = parser.extractFieldByLength(responseLength);
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
