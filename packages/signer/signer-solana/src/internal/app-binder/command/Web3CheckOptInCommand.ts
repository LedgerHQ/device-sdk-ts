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
} from "./ProvideWeb3CheckCommand";

export const TRANSACTION_CHECK_P1_OPT_IN = 0x01;

export type Web3CheckOptInCommandResponse = {
  enabled: boolean;
};

/**
 * Triggers Web3Checks opt-in on the Solana app.
 */
export class Web3CheckOptInCommand
  implements Command<Web3CheckOptInCommandResponse, void, SolanaAppErrorCodes>
{
  readonly name = "web3CheckOptIn";
  private readonly errorHelper = new CommandErrorHelper<
    Web3CheckOptInCommandResponse,
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
  ): CommandResult<Web3CheckOptInCommandResponse, SolanaAppErrorCodes> {
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
