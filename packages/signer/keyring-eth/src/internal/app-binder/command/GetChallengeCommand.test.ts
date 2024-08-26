import {
  Command,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import {
  GetChallengeCommand,
  GetChallengeCommandResponse,
} from "./GetChallengeCommand";

const GET_CHALLENGE_APDU = Uint8Array.from([0xe0, 0x20, 0x00, 0x00, 0x00]);

const LNX_RESPONSE_DATA_GOOD = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);

const LNX_RESPONSE_GOOD = {
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_GOOD,
};

const LNX_RESPONSE_LOCKED = {
  statusCode: Uint8Array.from([0x55, 0x15]),
  data: new Uint8Array(),
};

const LNX_RESPONSE_DATA_TOO_SHORT = Uint8Array.from([0x01, 0x02]);

const LNX_RESPONSE_TOO_SHORT = {
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_TOO_SHORT,
};

describe("GetChallengeCommand", () => {
  let command: Command<GetChallengeCommandResponse, void>;

  beforeEach(() => {
    command = new GetChallengeCommand();
  });

  describe("getApdu", () => {
    it("should return the challenge apdu", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_CHALLENGE_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const parsedResponse = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({
          data: {
            challenge: "01020304",
          },
        }),
      );
    });

    it("should return an error if the response is not successful", () => {
      const result = command.parseResponse(LNX_RESPONSE_LOCKED);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if the response is too short", () => {
      const result = command.parseResponse(LNX_RESPONSE_TOO_SHORT);

      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-ignore
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
