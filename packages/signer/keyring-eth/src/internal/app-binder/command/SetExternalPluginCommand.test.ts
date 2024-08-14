import {
  ApduResponse,
  CommandResultFactory,
  GlobalCommandError,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import {
  SetExternalPluginCommand,
  SetExternalPluginCommandError,
} from "@internal/app-binder/command/SetExternalPluginCommand";

/** Test payload contains:
 * Length of plugin name : 08
 * Plugin Name : Paraswap
 * contract address: 0xdef171fe48cf0115b1d80b88dc8eab59176fee57
 * method selector: 0xa9059cbb
 * **/
const SET_EXTERNAL_PLUGIN_PAYLOAD = [
  0x08, 0x50, 0x61, 0x72, 0x61, 0x73, 0x77, 0x61, 0x70, 0xde, 0xf1, 0x71, 0xfe,
  0x48, 0xcf, 0x01, 0x15, 0xb1, 0xd8, 0x0b, 0x88, 0xdc, 0x8e, 0xab, 0x59, 0x17,
  0x6f, 0xee, 0x57, 0xa9, 0x05, 0x9c, 0xbb,
];
// Public signature key: https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-external-plugin
const SET_EXTERNAL_PLUGIN_SIGNATURE = [
  0x04, 0x82, 0xbb, 0xf2, 0xf3, 0x4f, 0x36, 0x7b, 0x2e, 0x5b, 0xc2, 0x18, 0x47,
  0xb6, 0x56, 0x6f, 0x21, 0xf0, 0x97, 0x6b, 0x22, 0xd3, 0x38, 0x8a, 0x9a, 0x5e,
  0x44, 0x6a, 0xc6, 0x2d, 0x25, 0xcf, 0x72, 0x5b, 0x62, 0xa2, 0x55, 0x5b, 0x2d,
  0xd4, 0x64, 0xa4, 0xda, 0x0a, 0xb2, 0xf4, 0xd5, 0x06, 0x82, 0x05, 0x43, 0xaf,
  0x1d, 0x24, 0x24, 0x70, 0xb1, 0xb1, 0xa9, 0x69, 0xa2, 0x75, 0x78, 0xf3, 0x53,
];
const SET_EXTERNAL_PLUGIN_APDU = [
  0xe0,
  0x12,
  0x00,
  0x00,
  SET_EXTERNAL_PLUGIN_PAYLOAD.length + SET_EXTERNAL_PLUGIN_SIGNATURE.length,
  ...SET_EXTERNAL_PLUGIN_PAYLOAD,
  ...SET_EXTERNAL_PLUGIN_SIGNATURE,
];

describe("Set External plugin", () => {
  describe("getApdu", () => {
    it("should retrieve correct apdu", () => {
      // given
      const command = new SetExternalPluginCommand({
        payload: Uint8Array.from(SET_EXTERNAL_PLUGIN_PAYLOAD),
        signature: Uint8Array.from(SET_EXTERNAL_PLUGIN_SIGNATURE),
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from(SET_EXTERNAL_PLUGIN_APDU),
      );
    });
  });
  describe("parseResponse", () => {
    it.each`
      apduResponseCode                 | errorCode
      ${Uint8Array.from([0x6a, 0x80])} | ${"6a80"}
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
        const command = new SetExternalPluginCommand({
          payload: Uint8Array.from([]),
          signature: Uint8Array.from([]),
        });
        // WHEN
        const result = command.parseResponse(response);
        // THEN
        expect(isSuccessCommandResult(result)).toBe(false);
        // @ts-ignore
        expect(result.error).toBeInstanceOf(SetExternalPluginCommandError);
        // @ts-ignore
        expect(result.error.errorCode).toStrictEqual(errorCode);
      },
    );
    it("should return a global error", () => {
      // given
      const command = new SetExternalPluginCommand({
        payload: Uint8Array.from([]),
        signature: Uint8Array.from([]),
      });
      // when
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: Uint8Array.from([]),
      });
      // then
      const result = command.parseResponse(apduResponse);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-ignore
      expect(result.error).toBeInstanceOf(GlobalCommandError);
      // @ts-ignore
      expect(result.error.errorCode).toStrictEqual("5515");
    });
    it("should return void if status is success", () => {
      // given
      const command = new SetExternalPluginCommand({
        payload: Uint8Array.from([]),
        signature: Uint8Array.from([]),
      });
      // when
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // then
      expect(command.parseResponse(apduResponse)).toStrictEqual(
        CommandResultFactory({ data: undefined }),
      );
    });
  });
});
