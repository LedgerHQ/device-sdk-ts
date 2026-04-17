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
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

const CHALLENGE_LENGTH = 8;

export type GetChallengeCommandResponse = {
  challenge: string;
};

export class GetChallengeCommand
  implements Command<GetChallengeCommandResponse, void, ConcordiumErrorCodes>
{
  readonly name = "GetChallenge";

  private readonly errorHelper = new CommandErrorHelper<
    GetChallengeCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.GET_CHALLENGE,
      p1: 0x00,
      p2: P2.NONE,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetChallengeCommandResponse, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const challengeField = apduParser.extractFieldByLength(CHALLENGE_LENGTH);

      if (challengeField === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Challenge is missing"),
        });
      }

      const challenge = apduParser.encodeToHexaString(challengeField);

      return CommandResultFactory({
        data: { challenge },
      });
    });
  }
}
