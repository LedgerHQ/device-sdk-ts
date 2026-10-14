import { type LegacyCoinProfile, P2 } from "@ledgerhq/signer-btc-legacy-core";

import {
  ZCASH_ERROR_CONFIG,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

/** What the shared legacy core needs to know about the Zcash app. */
export const ZCASH_LEGACY_PROFILE: LegacyCoinProfile<ZcashErrorCodes> = {
  appName: "Zcash",
  errors: ZCASH_ERROR_CONFIG,
  newTransactionP2: P2.SAPLING,
};
