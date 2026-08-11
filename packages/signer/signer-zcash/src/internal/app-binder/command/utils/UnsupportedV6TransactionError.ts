import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "./zcashApplicationErrors";

/**
 * The connected app predates v6 (ZIP-229) support, so a UTXO whose source
 * transaction is a v6 cannot be turned into a trusted input.
 *
 * Reported in place of the 6a80 such an app answers to the first
 * GET_TRUSTED_INPUT APDU — a status word a dozen unrelated causes share, which
 * names neither what the app choked on nor what it would take to succeed. The app
 * rejects the transaction before signing anything, so this reports a limitation of
 * the installed app rather than work left half done.
 *
 * The message deliberately names no supporting version: the release carrying v6
 * support to users is not decided yet. `appVersion` reports what is installed and
 * leaves the caller to phrase any guidance.
 */
export class UnsupportedV6TransactionError extends DeviceExchangeError<ZcashErrorCodes> {
  /** Zcash app version the device session reported. */
  readonly appVersion: string;

  constructor(appVersion: string) {
    super({
      tag: "UnsupportedV6TransactionError",
      message: `The Zcash app version ${appVersion} installed on the device does not support V6 (Ironwood) source transactions, so a UTXO received from one cannot be signed. Support is expected in a future Zcash app update.`,
      errorCode: "unsupported_v6_transaction",
    });
    this.appVersion = appVersion;
  }
}
