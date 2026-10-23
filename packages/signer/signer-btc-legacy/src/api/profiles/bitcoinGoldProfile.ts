import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL_FORKID } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export const BITCOIN_GOLD_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Bitcoin Gold",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x0488b21e,
  sigHashType: SIGHASH_ALL_FORKID,
  bip143: true,
};
