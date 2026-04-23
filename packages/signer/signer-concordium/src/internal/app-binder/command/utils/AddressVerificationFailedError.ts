import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

/**
 * Raised when the trusted metadata service was reached but actively refused
 * the pubkey → address mapping (HTTP 4xx). This is a terminal, non-retryable
 * verification failure: the backend has looked up the mapping and does not
 * recognize it. Distinguished from {@link TrustedMetadataServiceError}, which
 * signals a transient service-side issue (network failure, 5xx, malformed
 * response).
 */
export class AddressVerificationFailedError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(message?: string) {
    super({
      tag: "AddressVerificationFailedError",
      message: message ?? "Address verification failed",
      errorCode: ConcordiumErrorCodes.ADDRESS_VERIFICATION_FAILED,
    });
  }
}
