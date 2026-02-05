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
  HELIUM_APP_ERRORS,
  HeliumAppCommandErrorFactory,
  type HeliumErrorCodes,
} from "./utils/heliumAppErrors";

const CLA = 0xe0;
const INS_SIGN_PAYMENT = 0x08;

export type SignTransactionCommandArgs = {
  transaction: Uint8Array;
  accountIndex?: number;
};

export type SignTransactionCommandResponse = {
  signedTransaction: Uint8Array;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, HeliumErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    HeliumErrorCodes
  >(HELIUM_APP_ERRORS, HeliumAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { transaction, accountIndex = 0 } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_PAYMENT,
      p1: accountIndex,
      p2: 0x00,
    });

    builder.addBufferToData(transaction);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HeliumErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 1) {
          const signedTransaction = parser.extractFieldByLength(responseLength);
          if (signedTransaction === undefined) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Cannot extract signed transaction"),
            });
          }

          return CommandResultFactory({ data: { signedTransaction } });
        }

        // Response length of 1 means user declined
        return CommandResultFactory({
          error: new InvalidStatusWordError("User declined the transaction"),
        });
      },
    );
  }
}
