import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_CLA,
  P1,
  P2,
  TRANSACTION_TYPE,
  type TransactionType,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

const START_UNTRUSTED_HASH_TRANSACTION_INPUT_INS = 0x44;

export type StartUntrustedHashTransactionInputCommandArgs = {
  readonly newTransaction: boolean;
  readonly firstRound: boolean;
  readonly transactionData: Uint8Array;
  // Defaults to a legacy transaction.
  readonly transactionType?: TransactionType;
};

export type StartUntrustedHashTransactionInputCommandResponse = ApduResponse;

export class LegacyStartUntrustedHashTransactionInputCommand<
  ErrorCodes extends string,
> implements
    Command<
      StartUntrustedHashTransactionInputCommandResponse,
      StartUntrustedHashTransactionInputCommandArgs,
      ErrorCodes
    >
{
  readonly name = "StartUntrustedHashTransactionInput";

  private readonly args: StartUntrustedHashTransactionInputCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    StartUntrustedHashTransactionInputCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: StartUntrustedHashTransactionInputCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const startUntrustedHashTransactionInputArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: START_UNTRUSTED_HASH_TRANSACTION_INPUT_INS,
      p1: this.args.firstRound ? P1.FIRST : P1.NEXT,
      p2: this.args.newTransaction
        ? (this.args.transactionType ?? TRANSACTION_TYPE.LEGACY)
        : P2.HASH_INPUT_CONTINUE,
    };

    return new ApduBuilder(startUntrustedHashTransactionInputArgs)
      .addBufferToData(this.args.transactionData)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    StartUntrustedHashTransactionInputCommandResponse,
    ErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
