import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

// The Bitcoin app before 2.1, the last versions on the legacy protocol. Later
// versions are signed by signer-btc.

export const BITCOIN_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Bitcoin",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x0488b21e,
  sigHashType: SIGHASH_ALL,
  bip143: false,
  transactionFormat: "standard",
};
