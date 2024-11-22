import { ApduResponse } from "@ledgerhq/device-management-kit";

import { CommandUtils } from "@internal/utils/CommandUtils";

describe("CommandUtils", () => {
  describe("isSuccessResponse", () => {
    it("should return true if statusCode is e000", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = CommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return true if statusCode is 9000", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = CommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return false if statusCode is not allowed", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x43, 0x04]),
        data: Uint8Array.from([]),
      });
      // when
      const result = CommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(false);
    });
  });
  describe("isSuccessResponse", () => {
    it("should return true if statusCode is e000", () => {
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = CommandUtils.isContinueResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return false if statusCode is 9000", () => {
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = CommandUtils.isContinueResponse(apduResponse);
      // then
      expect(result).toBe(false);
    });
  });
});
