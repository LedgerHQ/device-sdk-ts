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

import {
  P1,
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

const START_UNTRUSTED_HASH_TRANSACTION_INPUT = 0x44;

export type StartUntrustedHashTransactionInputCommandArgs = {
  newTransaction: boolean;
  firstRound: boolean;
  transactionData: Uint8Array;
};

export type StartUntrustedHashTransactionInputCommandResponse = ApduResponse;

export class StartUntrustedHashTransactionInputCommand
  implements
    Command<
      StartUntrustedHashTransactionInputCommandResponse,
      StartUntrustedHashTransactionInputCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "StartUntrustedHashTransactionInput";

  private readonly errorHelper = new CommandErrorHelper<
    StartUntrustedHashTransactionInputCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(
    private readonly args: StartUntrustedHashTransactionInputCommandArgs,
  ) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: START_UNTRUSTED_HASH_TRANSACTION_INPUT,
      p1: this.args.firstRound ? P1.FIRST : P1.NEXT,
      p2: this.args.newTransaction ? P2.SAPLING : P2.HASH_INPUT_CONTINUE,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(this.args.transactionData)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<
    StartUntrustedHashTransactionInputCommandResponse,
    ZcashErrorCodes
  > {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
