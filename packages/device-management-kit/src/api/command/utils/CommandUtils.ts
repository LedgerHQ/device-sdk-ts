import { type ApduResponse } from "@api/device-session/ApduResponse";

export class CommandUtils {
  static isValidStatusCode(statusCode: Uint8Array) {
    return statusCode.length === 2;
  }

  static isSuccessResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return statusCode[0] === 0x90 && statusCode[1] === 0x00;
  }

  static isLockedDeviceResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return statusCode[0] === 0x55 && statusCode[1] === 0x15;
  }
}
