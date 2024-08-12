import {
  GlobalCommandError,
  GlobalCommandErrorHandler,
} from "@api/command/utils/GlobalCommandError";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { isCommandErrorCode } from "./CommandErrors";

// [statusCode, errorTag, testLabel]
const GLOBAL_ERRORS_LIST: [Uint8Array, string, string][] = [
  [Uint8Array.from([0x55, 0x15]), "DeviceLockedError", "device locked error"],
  [Uint8Array.from([0x55, 0x01]), "ActionRefusedError", "action refused error"],
  [Uint8Array.from([0x55, 0x02]), "PinNotSetError", "pin not set error"],
  [
    Uint8Array.from([0x52, 0x23]),
    "DeviceInternalError",
    "device internal error",
  ],
];

describe("GlobalCommandError", () => {
  describe.each(GLOBAL_ERRORS_LIST)(
    "GlobalCommandErrorHandler",
    (statusCode, errorTag, testLabel) => {
      it(`should return a ${testLabel}`, () => {
        // given
        const apduResponse = new ApduResponse({
          statusCode,
          data: Uint8Array.from([]),
        });
        // when
        const result = GlobalCommandErrorHandler.handle(apduResponse);
        // then
        expect(result).toBeInstanceOf(GlobalCommandError);
        expect(result._tag).toStrictEqual(errorTag);
      });
    },
  );

  describe("isCommandErrorCode", () => {
    it("should return true if command error code is in list", () => {
      // given
      const errors = {
        4242: { message: "test" },
      };
      // when
      const isErrorCode = isCommandErrorCode("4242", errors);
      // then
      expect(isErrorCode).toBe(true);
    });
    it("should return false if command error code is not in list", () => {
      // given
      const errors = {
        4242: { message: "test" },
      };
      // when
      const isErrorCode = isCommandErrorCode("2121", errors);
      // then
      expect(isErrorCode).toBe(false);
    });
  });
});
