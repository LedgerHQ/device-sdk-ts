export const BlindSignReason = Object.freeze({
  NO_CLEAR_SIGNING_CONTEXT: "no_clear_signing_context",
  DEVICE_REJECTED_CONTEXT: "device_rejected_context",
  UNRECOGNIZED_PROGRAM: "unrecognized_program",
  STALE_DESCRIPTOR: "stale_descriptor",
} as const);
export type BlindSignReason =
  (typeof BlindSignReason)[keyof typeof BlindSignReason];
