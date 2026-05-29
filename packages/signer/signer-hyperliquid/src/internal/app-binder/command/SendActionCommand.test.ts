import {
  CommandResultFactory,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendActionCommand,
  type SendActionCommandArgs,
} from "./SendActionCommand";

// Per APP_SPECIFICATION.md (SET_ACTION):
//   CLA = 0xE0, INS = 0x03, P2 = 0x00
//   P1 = 0x01 for the first chunk, 0x00 for following chunks
//   First chunk data:  [lenH, lenL] (big-endian) + ACTION struct bytes
//   Following chunks:  ACTION struct continuation only
const FIRST_CHUNK_P1 = 0x01;
const FOLLOWING_CHUNK_P1 = 0x00;
const APDU_P2 = 0x00;

describe("SendActionCommand", () => {
  const chunkedData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

  const firstChunkArgs: SendActionCommandArgs = {
    chunkedData,
    more: false,
    extend: false,
  };

  describe("name", () => {
    it("should be 'sendAction'", () => {
      const command = new SendActionCommand(firstChunkArgs);
      expect(command.name).toBe("sendAction");
    });
  });

  describe("getApdu", () => {
    it("should build the first-chunk APDU (P1=0x01, P2=0x00) with chunkedData as raw data", () => {
      const command = new SendActionCommand(firstChunkArgs);

      const apdu = command.getApdu();

      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(FIRST_CHUNK_P1);
      expect(apdu.p2).toBe(APDU_P2);
      expect(apdu.data).toStrictEqual(chunkedData);
    });

    it("should keep P1=0x01 on the first chunk regardless of the `more` flag", () => {
      // The Hyperliquid spec does not use a `more` flag (the device knows the
      // total length from the 2-byte BE header in the first chunk). The
      // command should ignore it and only key off `extend`.
      const command = new SendActionCommand({
        chunkedData,
        more: true,
        extend: false,
      });

      const apdu = command.getApdu();

      expect(apdu.p1).toBe(FIRST_CHUNK_P1);
      expect(apdu.p2).toBe(APDU_P2);
    });

    it("should build a following-chunk APDU (P1=0x00, P2=0x00) when extend=true", () => {
      const command = new SendActionCommand({
        chunkedData,
        more: true,
        extend: true,
      });

      const apdu = command.getApdu();

      expect(apdu.p1).toBe(FOLLOWING_CHUNK_P1);
      expect(apdu.p2).toBe(APDU_P2);
      expect(apdu.data).toStrictEqual(chunkedData);
    });

    it("should keep P1=0x00 on the last chunk of a multi-chunk stream (extend=true, more=false)", () => {
      const command = new SendActionCommand({
        chunkedData,
        more: false,
        extend: true,
      });

      const apdu = command.getApdu();

      expect(apdu.p1).toBe(FOLLOWING_CHUNK_P1);
      expect(apdu.p2).toBe(APDU_P2);
    });
  });

  describe("parseResponse", () => {
    it("should return success when status is 0x9000 and no data", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = new SendActionCommand(firstChunkArgs).parseResponse(
        response,
      );
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("should return an error if the status code is not 0x9000", () => {
      const response = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = new SendActionCommand(firstChunkArgs).parseResponse(
        response,
      );
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = new SendActionCommand(firstChunkArgs).parseResponse(
        response,
      );
      expect(isSuccessCommandResult(result)).toBe(false);
      expect((result as { error: unknown }).error).toBeInstanceOf(
        InvalidResponseFormatError,
      );
    });
  });
});
