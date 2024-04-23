import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export class CommandUtils {
  static isSuccessResponse({ statusCode }: ApduResponse) {
    if (statusCode.length !== 2) {
      return false;
    }

    return statusCode[0] === 0x90 && statusCode[1] === 0x00;
  }
}
