import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignActionsCommand } from "./SignActionsCommand";

describe("SignActionsCommand", () => {
  let command: SignActionsCommand;

  beforeEach(() => {
    command = new SignActionsCommand();
  });

  describe("name", () => {
    it("should be 'SignActions'", () => {
      expect(command.name).toBe("SignActions");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x04);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data.length).toBe(0x00);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      };

      const parsedResponse = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({
          data: {
            signature: {
              r: "01020304",
              s: "01020304",
              v: 0x04,
            },
          },
        }),
      );
    });

    it("should return an error if the status code is not 0x9000", () => {
      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = command.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = command.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error response is not typed
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
