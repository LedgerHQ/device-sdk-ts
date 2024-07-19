// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#get-challenge
import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

const CHALLENGE_LENGTH = 4;

export type GetChallengeCommandResponse = {
  challenge: string;
};

export class GetChallengeCommand
  implements Command<GetChallengeCommandResponse, void>
{
  constructor() {}

  getApdu(): Apdu {
    const getChallengeArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x20,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getChallengeArgs).build();
  }

  parseResponse(response: ApduResponse): GetChallengeCommandResponse {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }

    if (parser.testMinimalLength(CHALLENGE_LENGTH) === false) {
      throw new InvalidStatusWordError("Challenge key is missing");
    }

    const challenge = parser.encodeToHexaString(
      parser.extractFieldByLength(CHALLENGE_LENGTH),
    );

    return {
      challenge,
    };
  }
}
