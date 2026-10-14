/**
 * Injection tokens of signer-btc-legacy. Distinct names, as Symbol.for is
 * global: a container that also loads another signer's modules must not mix
 * them up.
 */
export const btcLegacyTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  Profile: Symbol.for("BtcLegacyProfile"),
  AppBinder: Symbol.for("BtcLegacyAppBinder"),
} as const;
