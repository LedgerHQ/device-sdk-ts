import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  RemoveBackgroundImageCommand,
  RemoveBackgroundImageCommandError,
} from "./RemoveBackgroundImageCommand";

const REMOVE_IMAGE_APDU = new Uint8Array([0xe0, 0x63, 0x00, 0x00, 0x00]);

describe("RemoveBackgroundImageCommand", () => {
  let command: RemoveBackgroundImageCommand;

  beforeEach(() => {
    command = new RemoveBackgroundImageCommand();
  });

  describe("name", () => {
    it("should be 'removeBackgroundImage'", () => {
      expect(command.name).toBe("removeBackgroundImage");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(REMOVE_IMAGE_APDU);
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
        expect(result.error).toBeInstanceOf(RemoveBackgroundImageCommandError);
        expect(
          (result.error as RemoveBackgroundImageCommandError).message,
        ).toBe("User refused on device");
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
        expect(result.error).toBeInstanceOf(RemoveBackgroundImageCommandError);
        expect(
          (result.error as RemoveBackgroundImageCommandError).message,
        ).toBe("PIN not validated");
      }
    });

    it("should return error on internal registry error (6621)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x21]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(RemoveBackgroundImageCommandError);
        expect(
          (result.error as RemoveBackgroundImageCommandError).message,
        ).toBe("Internal registry error");
      }
    });

    it("should return error on no image loaded (662e)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x66, 0x2e]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(RemoveBackgroundImageCommandError);
        expect(
          (result.error as RemoveBackgroundImageCommandError).message,
        ).toBe("No background image loaded on device");
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
        expect(result.error).toBeInstanceOf(RemoveBackgroundImageCommandError);
        expect(
          (result.error as RemoveBackgroundImageCommandError).message,
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
