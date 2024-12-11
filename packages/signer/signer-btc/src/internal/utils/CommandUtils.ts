import {
  type ApduResponse,
  CommandUtils as DmkCommandUtils,
} from "@ledgerhq/device-management-kit";

import { SW_INTERRUPTED_EXECUTION } from "@internal/app-binder/command/utils/constants";

export class CommandUtils {
  static isContinueResponse(response: ApduResponse) {
    return (
      response.statusCode[0] === SW_INTERRUPTED_EXECUTION[0] &&
      response.statusCode[1] === SW_INTERRUPTED_EXECUTION[1]
    );
  }
  static isSuccessResponse(response: ApduResponse) {
    return (
      DmkCommandUtils.isSuccessResponse(response) ||
      CommandUtils.isContinueResponse(response)
    );
  }
}
