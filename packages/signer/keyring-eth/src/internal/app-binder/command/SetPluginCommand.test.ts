import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import {
  SetPluginCommand,
  SetPluginCommandArgs,
  SetPluginCommandError,
} from "./SetPluginCommand";

const SET_PLUGIN_COMMAND_PAYLOAD =
  "010106455243373231c5b07a55501014f36ec5d39d950a321439f6dd7642842e0e0000000000000001020147304502206d9f515916283e08fa6cdab205668c0739c558dcd6691a69ce74cd89fbc2cc6e022100c28c17b058e6d453570a58d69ff62042037dc61149af2f5161d5c36fdc5dc301";

const SET_PLUGIN_COMMAND_APDU = Uint8Array.from([
  0xe0, 0x16, 0x00, 0x00, 0x73, 0x01, 0x01, 0x06, 0x45, 0x52, 0x43, 0x37, 0x32,
  0x31, 0xc5, 0xb0, 0x7a, 0x55, 0x50, 0x10, 0x14, 0xf3, 0x6e, 0xc5, 0xd3, 0x9d,
  0x95, 0x0a, 0x32, 0x14, 0x39, 0xf6, 0xdd, 0x76, 0x42, 0x84, 0x2e, 0x0e, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x01, 0x47, 0x30, 0x45, 0x02,
  0x20, 0x6d, 0x9f, 0x51, 0x59, 0x16, 0x28, 0x3e, 0x08, 0xfa, 0x6c, 0xda, 0xb2,
  0x05, 0x66, 0x8c, 0x07, 0x39, 0xc5, 0x58, 0xdc, 0xd6, 0x69, 0x1a, 0x69, 0xce,
  0x74, 0xcd, 0x89, 0xfb, 0xc2, 0xcc, 0x6e, 0x02, 0x21, 0x00, 0xc2, 0x8c, 0x17,
  0xb0, 0x58, 0xe6, 0xd4, 0x53, 0x57, 0x0a, 0x58, 0xd6, 0x9f, 0xf6, 0x20, 0x42,
  0x03, 0x7d, 0xc6, 0x11, 0x49, 0xaf, 0x2f, 0x51, 0x61, 0xd5, 0xc3, 0x6f, 0xdc,
  0x5d, 0xc3, 0x01,
]);

describe("SetPluginCommand", () => {
  describe("getApdu", () => {
    it("returns the correct APDU", () => {
      // GIVEN
      const args: SetPluginCommandArgs = {
        data: SET_PLUGIN_COMMAND_PAYLOAD,
      };
      // WHEN
      const command = new SetPluginCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(SET_PLUGIN_COMMAND_APDU);
    });
  });
  describe("parseResponse", () => {
    it.each`
      apduResponseCode                 | errorCode
      ${Uint8Array.from([0x69, 0x84])} | ${"6984"}
      ${Uint8Array.from([0x6d, 0x00])} | ${"6d00"}
    `(
      "should return an error for the response status code $errorCode",
      ({ apduResponseCode, errorCode }) => {
        // GIVEN
        const response = new ApduResponse({
          data: Uint8Array.from([]),
          statusCode: apduResponseCode,
        });
        const command = new SetPluginCommand({ data: "" });
        // WHEN
        const result = command.parseResponse(response);
        // THEN
        expect(isSuccessCommandResult(result)).toBe(false);
        // @ts-ignore
        expect(result.error).toBeInstanceOf(SetPluginCommandError);
        // @ts-ignore
        expect(result.error.errorCode).toStrictEqual(errorCode);
      },
    );

    it("should return success if the response status code is correct", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
      };
      // WHEN
      const command = new SetPluginCommand({ data: "" });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
