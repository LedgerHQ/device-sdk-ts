import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { BTC_LEGACY_CLA, P1, P2 } from "./apduHeader";
import { type LegacyErrorConfig } from "./errors";
import { CommandErrorHelper } from "./signerUtils";

const START_UNTRUSTED_HASH_TRANSACTION_INPUT = 0x44;

export type StartUntrustedHashTransactionInputCommandArgs = {
  newTransaction: boolean;
  firstRound: boolean;
  transactionData: Uint8Array;
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
  private readonly errorHelper: CommandErrorHelper<
    StartUntrustedHashTransactionInputCommandResponse,
    ErrorCodes
  >;

  /**
   * @param newTransactionP2 P2 of a new transaction: 0x00 legacy, 0x02 BIP143,
   * 0x05 Zcash Sapling. Comes from the coin profile.
   */
  constructor(
    private readonly args: StartUntrustedHashTransactionInputCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
    private readonly newTransactionP2: number,
  ) {
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: START_UNTRUSTED_HASH_TRANSACTION_INPUT,
      p1: this.args.firstRound ? P1.FIRST : P1.NEXT,
      p2: this.args.newTransaction
        ? this.newTransactionP2
        : P2.HASH_INPUT_CONTINUE,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(this.args.transactionData)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<
    StartUntrustedHashTransactionInputCommandResponse,
    ErrorCodes
  > {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
