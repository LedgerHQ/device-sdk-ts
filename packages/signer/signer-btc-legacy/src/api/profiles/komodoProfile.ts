import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export const KOMODO_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Komodo",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0xf9eee48d,
  sigHashType: SIGHASH_ALL,
  bip143: false,
  transactionFormat: "sapling",
};
