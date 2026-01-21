import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  CommitBackgroundImageCommand,
  CommitBackgroundImageCommandError,
} from "./CommitBackgroundImageCommand";

const COMMIT_IMAGE_APDU = new Uint8Array([0xe0, 0x62, 0x00, 0x00, 0x00]);

describe("CommitBackgroundImageCommand", () => {
  let command: CommitBackgroundImageCommand;

  beforeEach(() => {
    command = new CommitBackgroundImageCommand();
  });

  describe("name", () => {
    it("should be 'commitBackgroundImage'", () => {
      expect(command.name).toBe("commitBackgroundImage");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(COMMIT_IMAGE_APDU);
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
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
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
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
        ).toBe("PIN not validated");
      }
    });

    it("should return error on image not created (551e)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x1e]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
        ).toBe("Image not created");
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
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
        ).toBe("Device is in recovery mode");
      }
    });

    it("should return error on invalid image metadata (681f)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x68, 0x1f]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
        ).toBe("Image metadata are not valid");
      }
    });

    it("should return error on invalid image size (6820)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x68, 0x20]),
        data: new Uint8Array([]),
      });
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(CommitBackgroundImageCommandError);
        expect(
          (result.error as CommitBackgroundImageCommandError).message,
        ).toBe("Invalid image size");
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
