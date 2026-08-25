import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

/**
 * Raised when a PLT transaction fails the local layout checks that mirror the
 * device-side validation. Rejecting here reports which field is malformed,
 * where the device reports only a status word.
 */
export class InvalidPltTransactionError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(message: string) {
    super({
      tag: "InvalidPltTransactionError",
      message: `Invalid PLT transaction: ${message}`,
      errorCode: ConcordiumErrorCodes.INVALID_PLT_TRANSACTION,
    });
  }
}
