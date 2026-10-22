// Symbol.for is global: Dmk and SessionId are shared with the container of a
// kit that loads this module, every other token is prefixed to stay unique.
export const btcLegacyTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  Profile: Symbol.for("BtcLegacyProfile"),
  AppBinder: Symbol.for("BtcLegacyAppBinder"),
  GetAddressUseCase: Symbol.for("BtcLegacyGetAddressUseCase"),
  GetExtendedPublicKeyUseCase: Symbol.for(
    "BtcLegacyGetExtendedPublicKeyUseCase",
  ),
  SignTransactionUseCase: Symbol.for("BtcLegacySignTransactionUseCase"),
  GetTrustedInputTask: Symbol.for("BtcLegacyGetTrustedInputTask"),
  SignTransactionTask: Symbol.for("BtcLegacySignTransactionTask"),
  TrustedInputSerializer: Symbol.for("BtcLegacyTrustedInputSerializer"),
  TransactionSerializer: Symbol.for("BtcLegacyTransactionSerializer"),
} as const;
