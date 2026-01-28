import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { BackgroundImageCommandError } from "./BackgroundImageCommandErrors";
import { CreateBackgroundImageCommand } from "./CreateBackgroundImageCommand";

const CREATE_IMAGE_APDU = new Uint8Array([
  0xe0, 0x60, 0x00, 0x00, 0x04, 0x00, 0x00, 0x89, 0xe9,
]);

describe("CreateBackgroundImageCommand", () => {
  let command: CreateBackgroundImageCommand;

  beforeEach(() => {
    command = new CreateBackgroundImageCommand({ imageSize: 35305 });
  });

  describe("name", () => {
    it("should be 'createBackgroundImage'", () => {
      expect(command.name).toBe("createBackgroundImage");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with image size", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(CREATE_IMAGE_APDU);
    });

    it("should encode different image sizes correctly", () => {
      const smallCommand = new CreateBackgroundImageCommand({ imageSize: 256 });
      const apdu = smallCommand.getApdu();
      // 256 = 0x00000100
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x60, 0x00, 0x00, 0x04, 0x00, 0x00, 0x01, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse successful response", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(result).toStrictEqual(CommandResultFactory({ data: undefined }));
    });

    it("should return error on user refused (5501)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x01]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "User refused on device",
        );
      }
    });

    it("should return error on PIN not validated (5502)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x02]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BackgroundImageCommandError);
        expect((result.error as BackgroundImageCommandError).message).toBe(
          "PIN not validated",
        );
      }
    });

    it("should return error on recovery mode (662f)", () => {
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
