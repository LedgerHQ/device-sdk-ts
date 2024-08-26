import { CommandErrorResult } from "@api/command/model/CommandResult";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { isSuccessCommandResult } from "@root/src";

import {
  OpenAppCommand,
  OpenAppCommandError,
  OpenAppErrorCodes,
} from "./OpenAppCommand";

describe("OpenAppCommand", () => {
  const appName = "MyApp";
  it("should return the correct APDU for opening an application", () => {
    const expectedApdu = Uint8Array.from([
      0xe0, 0xd8, 0x00, 0x00, 0x05, 0x4d, 0x79, 0x41, 0x70, 0x70,
    ]);
    const apdu = new OpenAppCommand({ appName }).getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(expectedApdu);
  });

  it("should not throw error when command is successful", () => {
    const apduResponse: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });
    expect(() =>
      new OpenAppCommand({ appName }).parseResponse(apduResponse),
    ).not.toThrow();
  });

  describe("errors", () => {
    it("should return a handled open app error if no name provided", () => {
      const apduResponse: ApduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x67, 0x0a]),
        data: new Uint8Array([]),
      });
      const result = new OpenAppCommand({ appName }).parseResponse(
        apduResponse,
      ) as CommandErrorResult<OpenAppErrorCodes>;
      expect(isSuccessCommandResult(result)).toBe(false);
      expect(result.error).toBeInstanceOf(OpenAppCommandError);
    });
    it("should return a handled open app error if unknown application name", () => {
      const apduResponse: ApduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x68, 0x07]),
        data: new Uint8Array([]),
      });
      const result = new OpenAppCommand({ appName }).parseResponse(
        apduResponse,
      ) as CommandErrorResult<OpenAppErrorCodes>;
      expect(isSuccessCommandResult(result)).toBe(false);
      expect(result.error).toBeInstanceOf(OpenAppCommandError);
    });
  });
});
