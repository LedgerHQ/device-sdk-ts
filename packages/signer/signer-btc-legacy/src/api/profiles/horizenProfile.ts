import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export const HORIZEN_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Horizen",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x0488b21e,
  sigHashType: SIGHASH_ALL,
  bip143: false,
  transactionFormat: "standard",
};
