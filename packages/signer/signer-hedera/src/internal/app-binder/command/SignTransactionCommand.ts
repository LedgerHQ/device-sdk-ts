import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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
  HEDERA_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  buildApduOrThrow,
  encodeKeyIndex,
} from "@internal/app-binder/command/utils/apduUtils";

import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaApplicationErrors";

const SIGNATURE_LENGTH = 64;

export type SignTransactionCommandArgs = {
  readonly keyIndex: number;
  readonly transactionBody: Uint8Array;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      HederaErrorCodes
    >
{
  readonly name = "SignTransaction";
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(readonly args: SignTransactionCommandArgs) {}

  getApdu(): Apdu {
    const signTransactionArgs: ApduBuilderArgs = {
      cla: HEDERA_CLA,
      ins: INS.SIGN_TRANSACTION,
      p1: P1.DEFAULT,
      p2: P2_DEFAULT,
    };
    return buildApduOrThrow(
      new ApduBuilder(signTransactionArgs)
        .addBufferToData(encodeKeyIndex(this.args.keyIndex))
        .addBufferToData(this.args.transactionBody),
    );
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length !== SIGNATURE_LENGTH) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract signature"),
        });
      }

      return CommandResultFactory({ data: Uint8Array.from(response.data) });
    });
  }
}
