export const BlindSigningMethod = Object.freeze({
  ETH_SIGN_TRANSACTION: "eth_signTransaction",
  ETH_SIGN_TYPED_DATA: "eth_signTypedData",
} as const);
export type BlindSigningMethod =
  (typeof BlindSigningMethod)[keyof typeof BlindSigningMethod];

export const BlindSignReason = Object.freeze({
  NO_CLEAR_SIGNING_CONTEXT: "no_clear_signing_context",
  DEVICE_REJECTED_CONTEXT: "device_rejected_context",
} as const);
export type BlindSignReason =
  (typeof BlindSignReason)[keyof typeof BlindSignReason];

export const ClearSigningType = Object.freeze({
  BASIC: "basic",
  EIP7730: "eip7730",
} as const);
export type ClearSigningType =
  (typeof ClearSigningType)[keyof typeof ClearSigningType];

export const BlindSigningPlatform = Object.freeze({
  DESKTOP: "desktop",
  MOBILE: "mobile",
} as const);
export type BlindSigningPlatform =
  (typeof BlindSigningPlatform)[keyof typeof BlindSigningPlatform];
