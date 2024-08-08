import { CloseAppCommand } from "@api/command/os/CloseAppCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { isSuccessCommandResult } from "@root/src";

const CLOSE_APP_APDU = new Uint8Array([0xb0, 0xa7, 0x00, 0x00, 0x00]);

describe("CloseAppCommand", () => {
  let closeAppCommand: CloseAppCommand;

  beforeEach(() => {
    closeAppCommand = new CloseAppCommand();
  });

  it("should return the correct APDU", () => {
    const apdu = closeAppCommand.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(CLOSE_APP_APDU);
  });

  it("should not be error when command is sucessful", () => {
    const apduResponse: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });
    expect(
      isSuccessCommandResult(closeAppCommand.parseResponse(apduResponse)),
    ).toBeTruthy();
  });

  it("should throw error when command is unsuccessful", () => {
    const apduResponse: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x6a, 0x81]),
      data: new Uint8Array([]),
    });
    expect(
      isSuccessCommandResult(closeAppCommand.parseResponse(apduResponse)),
    ).toBeFalsy();
  });
});
