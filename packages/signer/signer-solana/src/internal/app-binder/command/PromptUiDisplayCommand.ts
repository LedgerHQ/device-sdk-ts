import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const CLA = 0xe0;
export const INS = 0x0b;
export const P1 = 0x00;
export const P2 = 0x00;

/**
 * Triggers the review UI on the device. Sends an empty payload and returns no
 * data; non-success status words are surfaced as errors.
 */
export class PromptUiDisplayCommand
  implements Command<void, void, SolanaAppErrorCodes>
{
  readonly name = "promptUiDisplay";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({ cla: CLA, ins: INS, p1: P1, p2: P2 }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length !== 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unexpected data in response"),
        });
      }
      return CommandResultFactory({ data: undefined });
    });
  }
}
