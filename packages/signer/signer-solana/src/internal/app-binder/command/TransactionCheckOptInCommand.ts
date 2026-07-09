import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";
import {
  TRANSACTION_CHECK_CLA,
  TRANSACTION_CHECK_INS,
} from "./ProvideTransactionCheckCommand";

export const TRANSACTION_CHECK_P1_OPT_IN = 0x01;

export type TransactionCheckOptInCommandResponse = {
  enabled: boolean;
};

/**
 * Triggers TransactionChecks opt-in on the Solana app.
 */
export class TransactionCheckOptInCommand
  implements
    Command<TransactionCheckOptInCommandResponse, void, SolanaAppErrorCodes>
{
  readonly name = "transactionCheckOptIn";
  private readonly errorHelper = new CommandErrorHelper<
    TransactionCheckOptInCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: TRANSACTION_CHECK_CLA,
      ins: TRANSACTION_CHECK_INS,
      p1: TRANSACTION_CHECK_P1_OPT_IN,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addBufferToData(new Uint8Array([0x00]))
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<TransactionCheckOptInCommandResponse, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const enabled = new ApduParser(response).extract8BitUInt();
      if (enabled === undefined) {
        return CommandResultFactory({ data: { enabled: false } });
      }
      return CommandResultFactory({ data: { enabled: enabled !== 0 } });
    });
  }
}
