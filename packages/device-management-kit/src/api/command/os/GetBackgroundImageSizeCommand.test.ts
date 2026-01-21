import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetBackgroundImageSizeCommand,
  GetBackgroundImageSizeCommandError,
} from "@api/command/os/GetBackgroundImageSizeCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

const IMAGE_SIZE_APDU = new Uint8Array([0xe0, 0x64, 0x00, 0x00, 0x00]);

describe("GetBackgroundImageSizeCommand", () => {
  let command: GetBackgroundImageSizeCommand;

  beforeEach(() => {
    command = new GetBackgroundImageSizeCommand();
  });

  describe("name", () => {
    it("should be 'getBackgroundImageSize'", () => {
      expect(command.name).toBe("getBackgroundImageSize");
    });
  });

  it("should return the correct APDU", () => {
    const apdu = command.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(IMAGE_SIZE_APDU);
  });

  it("should parse result successfully", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x00, 0x00, 0x89, 0xe9]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: 35305,
      }),
    );
  });

  it("should fail on invalid size", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0xe9]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Didn't receive any size"),
      }),
    );
  });

  it("should return error on no image loaded (662e)", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x66, 0x2e]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(GetBackgroundImageSizeCommandError);
      expect((result.error as GetBackgroundImageSizeCommandError).message).toBe(
        "Invalid state, no background image loaded.",
      );
    }
  });

  it("should return error on recovery mode (662f)", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x66, 0x2f]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(GetBackgroundImageSizeCommandError);
      expect((result.error as GetBackgroundImageSizeCommandError).message).toBe(
        "Invalid state, device is in recovery mode.",
      );
    }
  });

  it("should return global error on unknown status code", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x6e, 0x00]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
