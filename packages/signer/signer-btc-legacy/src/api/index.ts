export type {
  LegacyCoinProfile,
  LegacyErrorConfig,
} from "@api/model/LegacyCoinProfile";
// For the signer kits built on the legacy protocol, such as signer-zcash: bind
// Dmk, SessionId and a profile in their own container, then load the module.
export { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
export {
  BTC_LEGACY_APP_ERRORS,
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
  BtcLegacyAppCommandErrorFactory,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
export { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
export { btcLegacyTypes } from "@internal/btcLegacyTypes";
