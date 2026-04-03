import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

export class UnsupportedTransactionTypeError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(type: number | undefined) {
    super({
      tag: "UnsupportedTransactionTypeError",
      message:
        type !== undefined
          ? `Unsupported transaction type: ${type} (0x${type.toString(16)}). Expected Transfer (3) or TransferWithMemo (22).`
          : "Transaction too short to determine type (need at least 61 bytes).",
      errorCode: ConcordiumErrorCodes.UNSUPPORTED_TRANSACTION_TYPE,
    });
  }
}
