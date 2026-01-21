import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetBackgroundImageHashCommand,
  GetBackgroundImageHashCommandError,
} from "./GetBackgroundImageHashCommand";

const GET_HASH_APDU = new Uint8Array([0xe0, 0x66, 0x00, 0x00, 0x00]);

describe("GetBackgroundImageHashCommand", () => {
  let command: GetBackgroundImageHashCommand;

  beforeEach(() => {
    command = new GetBackgroundImageHashCommand();
  });

  describe("name", () => {
    it("should be 'getBackgroundImageHash'", () => {
      expect(command.name).toBe("getBackgroundImageHash");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_HASH_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse successful response with hash", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0xab, 0xcd, 0xef, 0x12, 0x34]),
      });
      const result = command.parseResponse(response);
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { hash: "abcdef1234" },
        }),
      );
    });

    it("should return empty hash on no image loaded (662e)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x2e]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { hash: "" },
        }),
      );
    });

    it("should return error on recovery mode (662f)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x2f]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(GetBackgroundImageHashCommandError);
        expect(
          (result.error as GetBackgroundImageHashCommandError).message,
        ).toBe("Device is in recovery mode");
      }
    });

    it("should return global error on unknown status code", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6e, 0x00]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
