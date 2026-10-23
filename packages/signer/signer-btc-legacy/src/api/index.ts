export type {
  GetAddressDAError,
  GetAddressDAIntermediateValue,
  GetAddressDAOutput,
  GetAddressDAReturnType,
} from "@api/app-binder/GetAddressDeviceActionTypes";
export type {
  GetExtendedPublicKeyDAError,
  GetExtendedPublicKeyDAIntermediateValue,
  GetExtendedPublicKeyDAOutput,
  GetExtendedPublicKeyDAReturnType,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
export type { AddressFormat, AddressOptions } from "@api/model/AddressOptions";
export type { ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";
export type {
  LegacyCoinProfile,
  LegacyErrorConfig,
} from "@api/model/LegacyCoinProfile";
export { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
export * from "@api/SignerBtcLegacy";
export * from "@api/SignerBtcLegacyBuilder";
// For the signer kits built on the legacy protocol, such as signer-zcash: bind
// Dmk, SessionId and a profile in their own container, then load the module.
export { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
export {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
  LegacyGetAddressCommand,
} from "@internal/app-binder/command/GetAddressCommand";
export {
  BTC_LEGACY_APP_ERRORS,
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
  BtcLegacyAppCommandErrorFactory,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
export { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
export { btcLegacyTypes } from "@internal/btcLegacyTypes";
