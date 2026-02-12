import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { BackgroundImageCommandError } from "./BackgroundImageCommandErrors";
import { UploadBackgroundImageChunkCommand } from "./UploadBackgroundImageChunkCommand";

describe("UploadBackgroundImageChunkCommand", () => {
  describe("name", () => {
    it("should be 'uploadBackgroundImageChunk'", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01, 0x02]),
      });
      expect(command.name).toBe("uploadBackgroundImageChunk");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with offset and data", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0xab, 0xcd, 0xef]),
      });
      const apdu = command.getApdu();
      // CLA=0xe0, INS=0x61, P1=0x00, P2=0x00, Lc=7, offset(4 bytes) + data(3 bytes)
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x61, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00, 0xab, 0xcd,
          0xef,
        ]),
      );
    });

    it("should encode offset correctly", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 256, // 0x00000100
        data: new Uint8Array([0x01]),
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x61, 0x00, 0x00, 0x05, 0x00, 0x00, 0x01, 0x00, 0x01,
        ]),
      );
    });

    it("should handle larger offsets", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 35305, // 0x000089E9
        data: new Uint8Array([0xff]),
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x61, 0x00, 0x00, 0x05, 0x00, 0x00, 0x89, 0xe9, 0xff,
        ]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse successful response", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(result).toStrictEqual(CommandResultFactory({ data: undefined }));
    });

    it("should return error on create not called (5106)", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x51, 0x06]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "Invalid state, create background image has not been called",
        );
      }
    });

    it("should return error on image not created (551e)", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x1e]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "Image not created",
        );
      }
    });

    it("should return error on recovery mode (662f)", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
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

    it("should return error on APDU size too small (6703)", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x67, 0x03]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "APDU size is too small",
        );
      }
    });

    it("should return error on invalid chunk offset/length (680b)", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x68, 0x0b]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "Invalid chunk offset or length",
        );
      }
    });

    it("should return global error on unknown status code", () => {
      const command = new UploadBackgroundImageChunkCommand({
        offset: 0,
        data: new Uint8Array([0x01]),
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
