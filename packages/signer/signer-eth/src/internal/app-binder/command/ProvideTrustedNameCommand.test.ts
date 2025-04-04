import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  ProvideTrustedNameCommand,
  type ProvideTrustedNameCommandArgs,
} from "./ProvideTrustedNameCommand";

const FIRST_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x22, 0x01, 0x00, 0x08, 0x00, 0x06, 0x4c, 0x65, 0x64, 0x67, 0x65, 0x72,
]);

describe("ProvideTrustedNameCommand", () => {
  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // GIVEN
      const args: ProvideTrustedNameCommandArgs = {
        data: FIRST_CHUNK_APDU.slice(5),
        isFirstChunk: true,
      };
      // WHEN
      const command = new ProvideTrustedNameCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(FIRST_CHUNK_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]), // Invalid status code
      };
      // WHEN
      const command = new ProvideTrustedNameCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return success if the response status code is correct", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
      };
      // WHEN
      const command = new ProvideTrustedNameCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
