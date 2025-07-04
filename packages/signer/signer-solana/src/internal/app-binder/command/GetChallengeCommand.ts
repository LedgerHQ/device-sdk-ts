// https://github.com/LedgerHQ/app-solana/blob/develop/doc/api.md#get-challenge
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

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const CLA = 0xe0;
const INS = 0x20;
const P1 = 0x00;
const P2 = 0x00;
const CHALLENGE_LENGTH = 4;

export type GetChallengeCommandResponse = {
  challenge: string;
};

export class GetChallengeCommand
  implements Command<GetChallengeCommandResponse, void, SolanaAppErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<
    GetChallengeCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetChallengeCommandResponse, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      if (parser.testMinimalLength(CHALLENGE_LENGTH) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Challenge key is missing"),
        });
      }

      const challenge = parser.encodeToHexaString(
        parser.extractFieldByLength(CHALLENGE_LENGTH),
      );

      return CommandResultFactory({
        data: {
          challenge,
        },
      });
    });
  }
}
