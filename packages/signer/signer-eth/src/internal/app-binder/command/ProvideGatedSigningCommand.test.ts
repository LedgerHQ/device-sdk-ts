import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  ProvideGatedSigningCommand,
  type ProvideGatedSigningCommandArgs,
} from "./ProvideGatedSigningCommand";

// First chunk: CLA=E0, INS=38, P1=01, P2=00, Lc=8, payload_length=6 (2 bytes), 6 bytes descriptor
const FIRST_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x38, 0x01, 0x00, 0x08, 0x00, 0x06, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
]);

// Following chunk: CLA=E0, INS=38, P1=00, P2=00, Lc=3, 3 bytes descriptor
const FOLLOWING_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x38, 0x00, 0x00, 0x03, 0x07, 0x08, 0x09,
]);

describe("ProvideGatedSigningCommand", () => {
  describe("name", () => {
    it("should be 'provideGatedSigning'", () => {
      const command = new ProvideGatedSigningCommand({
        data: new Uint8Array(),
        isFirstChunk: true,
      });
      expect(command.name).toBe("provideGatedSigning");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU for first chunk (P1=0x00)", () => {
      const args: ProvideGatedSigningCommandArgs = {
        data: FIRST_CHUNK_APDU.slice(5),
        isFirstChunk: true,
      };
      const command = new ProvideGatedSigningCommand(args);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(FIRST_CHUNK_APDU);
    });

    it("should return the raw APDU for following chunk (P1=0x01)", () => {
      const args: ProvideGatedSigningCommandArgs = {
        data: FOLLOWING_CHUNK_APDU.slice(5),
        isFirstChunk: false,
      };
      const command = new ProvideGatedSigningCommand(args);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(FOLLOWING_CHUNK_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]),
      };
      const command = new ProvideGatedSigningCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return success if the response status code is correct", () => {
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]),
      };
      const command = new ProvideGatedSigningCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
