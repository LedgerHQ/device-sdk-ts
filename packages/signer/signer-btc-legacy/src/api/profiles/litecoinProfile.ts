import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export const LITECOIN_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Litecoin",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x019da462,
  segwit: true,
  sigHashType: SIGHASH_ALL,
  bip143: false,
};
