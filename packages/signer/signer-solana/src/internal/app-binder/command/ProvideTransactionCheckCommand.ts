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

import { buildChunkP2 } from "./utils/apduChunking";
import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const TRANSACTION_CHECK_CLA = 0xe0;
export const TRANSACTION_CHECK_INS = 0x23;
export const TRANSACTION_CHECK_P1_PROVIDE = 0x00;

export type ProvideTransactionCheckCommandArgs = {
  readonly payload: Uint8Array;
  readonly isFirstChunk: boolean;
  readonly hasMore: boolean;
};

/**
 * Sends a chunk of the TransactionChecks transaction-check descriptor to the Solana app.
 * P2 uses the standard EXTEND/MORE chunking protocol:
 *   - Single chunk:  P2 = 0x00
 *   - First of many: P2 = 0x02 (MORE)
 *   - Middle:        P2 = 0x03 (MORE | EXTEND)
 *   - Last:          P2 = 0x01 (EXTEND)
 */
export class ProvideTransactionCheckCommand
  implements
    Command<void, ProvideTransactionCheckCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideTransactionCheck";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(private readonly args: ProvideTransactionCheckCommandArgs) {}

  getApdu(): Apdu {
    const p2 = buildChunkP2(this.args.isFirstChunk, this.args.hasMore);

    const apduBuilderArgs: ApduBuilderArgs = {
      cla: TRANSACTION_CHECK_CLA,
      ins: TRANSACTION_CHECK_INS,
      p1: TRANSACTION_CHECK_P1_PROVIDE,
      p2,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SolanaAppErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
