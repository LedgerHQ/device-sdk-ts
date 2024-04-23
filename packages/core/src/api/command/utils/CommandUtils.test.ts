import { ApduResponse } from "@internal/device-session/model/ApduResponse";

import { CommandUtils } from "./CommandUtils";

describe("CommandUtils", () => {
  describe("static isSuccessResponse", () => {
    it("should return true if the status code is 0x9000", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(true);
    });

    it("should return false if the status code is not 0x9000", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6e, 0x80]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(false);
    });

    it("should return false if the status code is not 2 bytes long", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(false);
    });
  });
});
