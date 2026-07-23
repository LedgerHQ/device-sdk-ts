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
  INS,
  LEDGER_CLA,
  P2_NONE,
  SIGNATURE_LENGTH,
} from "@internal/app-binder/constants";

import { encodeDerivationPath } from "./utils/encodeDerivationPath";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronAppErrorCodes,
} from "./utils/tronApplicationErrors";

export type SignTransactionHashCommandArgs = {
  readonly derivationPath: string;
  // The 32-byte hash of the protobuf-serialized `raw_data` of the transaction.
  readonly transactionHash: Uint8Array;
};

export type SignTransactionHashCommandResponse = Signature;

/**
 * Signs a transaction hash directly (SIGN_TRANSACTION_HASH instruction), in a
 * single APDU. Only accepted by the Tron app when its "sign by hash" setting
 * is enabled (see `signByHash` in the app configuration).
 */
export class SignTransactionHashCommand
  implements
    Command<
      SignTransactionHashCommandResponse,
      SignTransactionHashCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "SignTransactionHash";

  private readonly _args: SignTransactionHashCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionHashCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: SignTransactionHashCommandArgs) {
    this._args = args;
  }

  get args(): SignTransactionHashCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_TRANSACTION_HASH,
      p1: 0x00,
      p2: P2_NONE,
    })
      .addBufferToData(encodeDerivationPath(this._args.derivationPath))
      .addBufferToData(this._args.transactionHash)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionHashCommandResponse, TronAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);
      if (signature === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is missing"),
        });
      }

      return CommandResultFactory({ data: signature });
    });
  }
}
