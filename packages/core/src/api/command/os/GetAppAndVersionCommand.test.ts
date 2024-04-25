import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { Command } from "../Command";
import {
  GetAppAndVersionResponse,
  GetAppAndVersionCommand,
} from "./GetAppAndVersionCommand";

const GET_APP_AND_VERSION_APDU = Uint8Array.from([
  0xb0, 0x01, 0x00, 0x00, 0x00,
]);

const STAX_RESPONSE_HEX = Uint8Array.from([
  0x01, 0x05, 0x42, 0x4f, 0x4c, 0x4f, 0x53, 0x09, 0x31, 0x2e, 0x34, 0x2e, 0x30,
  0x2d, 0x72, 0x63, 0x32, 0x90, 0x00,
]);

describe("GetAppAndVersionCommand", () => {
  let command: Command<void, GetAppAndVersionResponse>;

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
    it("should parse the GetAppAndVersion response", () => {
      const STAX_APDU_RESPONSE = new ApduResponse({
        statusCode: STAX_RESPONSE_HEX.slice(-2),
        data: STAX_RESPONSE_HEX.slice(0, -2),
      });
      const parsed = command.parseResponse(STAX_APDU_RESPONSE);
      const expected = {
        name: "BOLOS",
        version: "1.4.0-rc2",
      };
      expect(parsed).toStrictEqual(expected);
    });
  });
});
