import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { BackgroundImageCommandError } from "./BackgroundImageCommandErrors";
import { FetchBackgroundImageChunkCommand } from "./FetchBackgroundImageChunkCommand";

describe("FetchBackgroundImageChunkCommand", () => {
  describe("name", () => {
    it("should be 'fetchBackgroundImageChunk'", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      expect(command.name).toBe("fetchBackgroundImageChunk");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with offset and length", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 238,
      });
      const apdu = command.getApdu();
      // CLA=0xe0, INS=0x65, P1=0x00, P2=0x00, Lc=5, offset(4 bytes) + length(1 byte)
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x65, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0xee,
        ]),
      );
    });

    it("should encode offset correctly", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 35305, // 0x000089E9
        length: 100,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x65, 0x00, 0x00, 0x05, 0x00, 0x00, 0x89, 0xe9, 0x64,
        ]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse successful response with data", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 5,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
      });
      const result = command.parseResponse(response);
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { data: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]) },
        }),
      );
    });

    it("should return error on empty response data", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(
          (result.error as InvalidStatusWordError).originalError?.message,
        ).toBe("No data received from device");
      }
    });

    it("should return error on no image loaded (662e)", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x2e]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "No background image loaded on device",
        );
      }
    });

    it("should return error on recovery mode (662f)", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x2f]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "Device is in recovery mode",
        );
      }
    });

    it("should return error on invalid chunk size (6832)", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x68, 0x32]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "Invalid image chunk size requested",
        );
      }
    });

    it("should return global error on unknown status code", () => {
      const command = new FetchBackgroundImageChunkCommand({
        offset: 0,
        length: 100,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6e, 0x00]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
