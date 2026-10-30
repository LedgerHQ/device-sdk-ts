import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "./zcashApplicationErrors";

/**
 * The transaction declares the account a shielded output pays, but the installed
 * Zcash app predates that extension (it is accepted from app 3.9.5) or did not
 * report a readable version.
 *
 * Raised by the kit before any PCZT APDU is sent, so nothing was streamed to the
 * device. `appVersion` reports what the device answered and leaves the caller to
 * phrase any guidance.
 */
export class UnsupportedOutputAccountDeclarationError extends DeviceExchangeError<ZcashErrorCodes> {
  /** Zcash app version the device session reported. */
  readonly appVersion: string;

  constructor(appVersion: string) {
    super({
      tag: "UnsupportedOutputAccountDeclarationError",
      message: `The Zcash app version ${appVersion} installed on the device does not support declaring the account a shielded output pays. This needs Zcash app 3.9.5 or later.`,
      errorCode: "unsupported_output_account",
    });
    this.appVersion = appVersion;
  }
}
