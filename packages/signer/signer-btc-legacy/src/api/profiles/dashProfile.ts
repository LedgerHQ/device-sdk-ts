import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export const DASH_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Dash",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x02fe52f8,
  sigHashType: SIGHASH_ALL,
  bip143: false,
  transactionFormat: "standard",
};
