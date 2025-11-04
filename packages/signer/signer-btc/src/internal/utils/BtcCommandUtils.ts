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
import { type WalletAddress, type WalletIdentity } from "@api/model/Wallet";
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

  static getAddress(
    response: CommandSuccessResult<ApduResponse>,
  ): CommandResult<WalletAddress, BtcErrorCodes> {
    const parser = new ApduParser(response.data);
    if (!response.data) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract address from response",
        ),
      });
    }

    const address = parser.encodeToString(response.data.data);
    return CommandResultFactory({
      data: {
        address,
      },
    });
  }

  static getWalletIdentity(
    response: CommandSuccessResult<ApduResponse>,
  ): CommandResult<WalletIdentity, BtcErrorCodes> {
    const parser = new ApduParser(response.data);

    const walletId = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
    );
    const hmac = parser.extractFieldByLength(R_LENGTH);

    if (!hmac) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Hmac is missing"),
      });
    }

    return CommandResultFactory({
      data: {
        walletId,
        hmac,
      },
    });
  }
}
