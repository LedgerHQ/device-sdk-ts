import {
  type ApduResponse,
  CommandUtils as DmkCommandUtils,
} from "@ledgerhq/device-management-kit";

export class CommandUtils {
  static isContinueResponse({ statusCode }: ApduResponse) {
    return statusCode[0] === 0xe0 && statusCode[1] === 0x00;
  }
  static isSuccessResponse(response: ApduResponse) {
    return (
      DmkCommandUtils.isSuccessResponse(response) ||
      CommandUtils.isContinueResponse(response)
    );
  }
}
