import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { GetCustomImageSizeCommand } from "@api/command/os/GetCustomImageSizeCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

const IMAGE_SIZE_APDU = new Uint8Array([0xe0, 0x64, 0x00, 0x00, 0x00]);

describe("GetCustomImageSizeCommand", () => {
  let command: GetCustomImageSizeCommand;

  beforeEach(() => {
    command = new GetCustomImageSizeCommand();
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

  it("should fail on device error", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x66, 0x2e]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(isSuccessCommandResult(result)).toBeFalsy();
  });
});
