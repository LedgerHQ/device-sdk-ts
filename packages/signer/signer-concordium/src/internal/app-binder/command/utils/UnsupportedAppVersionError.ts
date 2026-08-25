import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

/**
 * Raised when the transaction kind is supported by the signer but not by the
 * app version installed on the device. Distinguishable from a signing failure
 * so that the caller can prompt the user to update the app.
 */
export class UnsupportedAppVersionError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(feature: string, minVersion: string) {
    super({
      tag: "UnsupportedAppVersionError",
      message: `The installed Concordium app does not support ${feature}. Version ${minVersion} or later is required.`,
      errorCode: ConcordiumErrorCodes.UNSUPPORTED_APP_VERSION,
    });
  }
}
