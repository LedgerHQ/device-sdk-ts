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
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const TRANSACTION_CHECK_CLA = 0xe0;
export const TRANSACTION_CHECK_INS = 0x23;
export const TRANSACTION_CHECK_P1_PROVIDE = 0x00;
export const P2_EXTEND = 0x01;
export const P2_MORE = 0x02;

export type ProvideWeb3CheckCommandArgs = {
  readonly payload: Uint8Array;
  readonly isFirstChunk: boolean;
  readonly hasMore: boolean;
};

/**
 * Sends a chunk of the Web3Checks transaction-check descriptor to the Solana app.
 * P2 uses the standard EXTEND/MORE chunking protocol:
 *   - Single chunk:  P2 = 0x00
 *   - First of many: P2 = 0x02 (MORE)
 *   - Middle:        P2 = 0x03 (MORE | EXTEND)
 *   - Last:          P2 = 0x01 (EXTEND)
 */
export class ProvideWeb3CheckCommand
  implements Command<void, ProvideWeb3CheckCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideWeb3Check";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(private readonly args: ProvideWeb3CheckCommandArgs) {}

  getApdu(): Apdu {
    let p2 = 0x00;
    if (!this.args.isFirstChunk) p2 |= P2_EXTEND;
    if (this.args.hasMore) p2 |= P2_MORE;

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
