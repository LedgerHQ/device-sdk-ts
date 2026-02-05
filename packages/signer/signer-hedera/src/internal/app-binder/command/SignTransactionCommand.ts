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
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaAppErrors";

const CLA = 0xe0;
const INS_SIGN_TRANSACTION = 0x04;

export type SignTransactionCommandArgs = {
  transaction: Uint8Array;
};

export type SignTransactionCommandResponse = {
  signature: string;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, HederaErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { transaction } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TRANSACTION,
      p1: 0x00,
      p2: 0x00,
    });

    // Hedera: 4 bytes account index (LE) + transaction data
    // Note: BOLOS app only supports index #0 for signing
    builder.add32BitUIntToData(0); // Account index 0 (LE format)
    builder.addBufferToData(transaction);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HederaErrorCodes> {
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

        return CommandResultFactory({
          error: new InvalidStatusWordError("No signature in response"),
        });
      },
    );
  }
}
