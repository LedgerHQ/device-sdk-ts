import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_ERRORS,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

export const DOGECOIN_PROFILE: LegacyCoinProfile<BtcLegacyErrorCodes> = {
  appName: "Dogecoin",
  errors: BTC_LEGACY_ERRORS,
  xpubVersion: 0x02facafd,
};
