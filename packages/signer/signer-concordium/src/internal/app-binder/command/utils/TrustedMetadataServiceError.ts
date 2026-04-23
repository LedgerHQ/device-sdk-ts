import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

export class TrustedMetadataServiceError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(message?: string) {
    super({
      tag: "TrustedMetadataServiceError",
      message: message ?? "Trusted metadata service error",
      errorCode: ConcordiumErrorCodes.TRUSTED_METADATA_SERVICE_ERROR,
    });
  }
}
