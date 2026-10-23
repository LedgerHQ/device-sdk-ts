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
export type {
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAOutput,
  SignTransactionDAReturnType,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
export type { AddressFormat, AddressOptions } from "@api/model/AddressOptions";
export type {
  LegacyCreateTransactionArg,
  LegacyTransaction,
  LegacyTransactionInput,
  LegacyTransactionOutput,
} from "@api/model/CreateTransactionArg";
export type { ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";
export type {
  LegacyCoinProfile,
  LegacyErrorConfig,
} from "@api/model/LegacyCoinProfile";
export type { TransactionOptions } from "@api/model/TransactionOptions";
export { DOGECOIN_PROFILE } from "@api/profiles/dogecoinProfile";
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
  type GetTrustedInputCommandArgs,
  type GetTrustedInputCommandResponse,
  LegacyGetTrustedInputCommand,
} from "@internal/app-binder/command/GetTrustedInputCommand";
export {
  type HashOutputFullCommandArgs,
  type HashOutputFullCommandResponse,
  LegacyHashOutputFullCommand,
} from "@internal/app-binder/command/HashOutputFullCommand";
export {
  LegacyProvideOutputFullChangePathCommand,
  type ProvideOutputFullChangePathCommandArgs,
  type ProvideOutputFullChangePathCommandResponse,
} from "@internal/app-binder/command/ProvideOutputFullChangePathCommand";
export {
  LegacySignTransactionCommand,
  type SignTransactionCommandArgs,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
export {
  LegacyStartUntrustedHashTransactionInputCommand,
  type StartUntrustedHashTransactionInputCommandArgs,
  type StartUntrustedHashTransactionInputCommandResponse,
} from "@internal/app-binder/command/StartUntrustedHashTransactionInputCommand";
export {
  BTC_LEGACY_APP_ERRORS,
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
  BtcLegacyAppCommandErrorFactory,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
export { StandardTransactionSerializer } from "@internal/app-binder/task/format/StandardTransactionSerializer";
export { StandardTrustedInputSerializer } from "@internal/app-binder/task/format/StandardTrustedInputSerializer";
export type {
  SignedTransactionInput,
  TransactionSerializer,
} from "@internal/app-binder/task/format/TransactionSerializer";
export type { TrustedInputSerializer } from "@internal/app-binder/task/format/TrustedInputSerializer";
export { GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
export { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
export { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
export { btcLegacyTypes } from "@internal/btcLegacyTypes";
