import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { GetAppAndVersionCommand } from "./GetAppAndVersionCommand";

const GET_APP_AND_VERSION_APDU = Uint8Array.from([
  0xb0, 0x01, 0x00, 0x00, 0x00,
]);

const OS_RESPONSE_HEX = Uint8Array.from([
  0x01, 0x05, 0x42, 0x4f, 0x4c, 0x4f, 0x53, 0x09, 0x31, 0x2e, 0x34, 0x2e, 0x30,
  0x2d, 0x72, 0x63, 0x32, 0x90, 0x00,
]);

const APP_RESPONSE_HEX = Uint8Array.from([
  0x01, 0x07, 0x42, 0x69, 0x74, 0x63, 0x6f, 0x69, 0x6e, 0x0b, 0x32, 0x2e, 0x31,
  0x2e, 0x35, 0x2d, 0x61, 0x6c, 0x70, 0x68, 0x61, 0x01, 0x02, 0x90, 0x00,
]);

const FAILED_RESPONSE_HEX = Uint8Array.from([0x67, 0x00]);

const ERROR_RESPONSE_HEX = Uint8Array.from([0x04, 0x90, 0x00]);

describe("GetAppAndVersionCommand", () => {
  let command: GetAppAndVersionCommand;

  beforeEach(() => {
    command = new GetAppAndVersionCommand();
  });

  describe("getApdu", () => {
    it("should return the GetAppAndVersion APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_APP_AND_VERSION_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response when launching OS (dashboard)", () => {
      const OS_RESPONSE = new ApduResponse({
        statusCode: OS_RESPONSE_HEX.slice(-2),
        data: OS_RESPONSE_HEX.slice(0, -2),
      });
      const parsed = command.parseResponse(OS_RESPONSE);
      const expected = CommandResultFactory({
        data: {
          name: "BOLOS",
          version: "1.4.0-rc2",
        },
      });
      expect(parsed).toStrictEqual(expected);
    });
    it("should parse the response when launching App", () => {
      const APP_RESPONSE = new ApduResponse({
        statusCode: APP_RESPONSE_HEX.slice(-2),
        data: APP_RESPONSE_HEX.slice(0, -2),
      });
      const parsed = command.parseResponse(APP_RESPONSE);
      const expected = CommandResultFactory({
        data: {
          name: "Bitcoin",
          version: "2.1.5-alpha",
          flags: Uint8Array.from([2]),
        },
      });
      expect(parsed).toStrictEqual(expected);
    });
    it("should throw an error if the command failed", () => {
      // given
      const FAILED_RESPONSE = new ApduResponse({
        statusCode: FAILED_RESPONSE_HEX.slice(-2),
        data: FAILED_RESPONSE_HEX.slice(0, -2),
      });
      // when
      const result = command.parseResponse(FAILED_RESPONSE);

      // then
      expect(isSuccessCommandResult(result)).toBeFalsy();
    });
    it("should return an error if the response returned unsupported format", () => {
      // given
      const ERROR_RESPONSE = new ApduResponse({
        statusCode: ERROR_RESPONSE_HEX.slice(-2),
        data: ERROR_RESPONSE_HEX.slice(0, -2),
      });
      // when
      const response = command.parseResponse(ERROR_RESPONSE);

      // then
      expect(isSuccessCommandResult(response)).toBeFalsy();
    });
  });
});
