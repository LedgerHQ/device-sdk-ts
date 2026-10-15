// Symbol.for is global: Dmk and SessionId are shared with the container of a
// kit that loads this module, every other token is prefixed to stay unique.
export const btcLegacyTypes = {
  Dmk: Symbol.for("Dmk"),
  SessionId: Symbol.for("SessionId"),
  Profile: Symbol.for("BtcLegacyProfile"),
  AppBinder: Symbol.for("BtcLegacyAppBinder"),
} as const;
