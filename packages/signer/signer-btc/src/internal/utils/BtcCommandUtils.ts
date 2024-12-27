import {
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type CommandSuccessResult,
  CommandUtils as DmkCommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { SW_INTERRUPTED_EXECUTION } from "@internal/app-binder/command/utils/constants";

const R_LENGTH = 32;
const S_LENGTH = 32;

export class BtcCommandUtils {
  static isContinueResponse(response: ApduResponse) {
    return (
      response.statusCode[0] === SW_INTERRUPTED_EXECUTION[0] &&
      response.statusCode[1] === SW_INTERRUPTED_EXECUTION[1]
    );
  }
  static isSuccessResponse(response: ApduResponse) {
    return (
      DmkCommandUtils.isSuccessResponse(response) ||
      BtcCommandUtils.isContinueResponse(response)
    );
  }

  static getSignature(
    result: CommandSuccessResult<ApduResponse>,
  ): CommandResult<Signature, BtcErrorCodes> {
    const parser = new ApduParser(result.data);

    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("V is missing"),
      });
    }

    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: {
        v,
        r,
        s,
      },
    });
  }
}
