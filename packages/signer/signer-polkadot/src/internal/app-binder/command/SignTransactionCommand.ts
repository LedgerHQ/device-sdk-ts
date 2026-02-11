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
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandErrorFactory,
  type PolkadotErrorCodes,
} from "./utils/polkadotAppErrors";

const CLA = 0xf9;
const INS_SIGN_ED25519 = 0x02;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  chunkIndex: number;
  totalChunks: number;
};

export type SignTransactionCommandResponse = {
  signature?: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, PolkadotErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    PolkadotErrorCodes
  >(POLKADOT_APP_ERRORS, PolkadotAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  static get CHUNK_SIZE(): number {
    return 250;
  }

  getApdu(): Apdu {
    const { data, chunkIndex, totalChunks } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_ED25519,
      p1: chunkIndex,
      p2: totalChunks,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, PolkadotErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 64) {
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

        return CommandResultFactory({ data: {} });
      },
    );
  }
}
