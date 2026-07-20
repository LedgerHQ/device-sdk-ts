export const APP_NAME = "Tron";

// Tron application APDU class byte.
export const LEDGER_CLA = 0xe0;

// Tron application instruction bytes
export const INS = {
  GET_ADDRESS: 0x02,
  SIGN_TRANSACTION: 0x04,
  SIGN_TRANSACTION_HASH: 0x05,
  GET_APP_CONFIGURATION: 0x06,
  SIGN_PERSONAL_MESSAGE: 0x08,
  ECDH_SECRET: 0x0a,
} as const;

// Maximum APDU payload chunk size used by the Tron application.
export const CHUNK_SIZE = 250;

// Common P2 value for the Tron application commands.
export const P2_NONE = 0x00;

// Length of a Tron signature (r[32] + s[32] + v[1]).
export const SIGNATURE_LENGTH = 65;

// Length of a chain code returned by the GetAddress command.
export const CHAIN_CODE_LENGTH = 32;

// Length of the ECDH shared point (0x04 || X || Y) returned by ECDH_SECRET.
export const ECDH_SECRET_LENGTH = 65;

/**
 * P1 "start byte" values for the SIGN_TRANSACTION instruction.
 *
 * The Tron app frames a transaction across several APDUs and encodes the frame
 * position in P1. The multi-frame chunking is orchestrated by
 * `SignTransactionTask`.
 */
export const SIGN_TRANSACTION_P1 = {
  // First and only frame (transaction fits in a single APDU).
  SINGLE: 0x10,
  // First frame, more frames to follow.
  FIRST: 0x00,
  // Continuation frame.
  SUBSEQUENT: 0x80,
  // Last continuation frame.
  LAST: 0x90,
} as const;

/**
 * P1 values for the SIGN_PERSONAL_MESSAGE instruction.
 */
export const SIGN_PERSONAL_MESSAGE_P1 = {
  // First frame.
  FIRST: 0x00,
  // Continuation frame.
  SUBSEQUENT: 0x80,
} as const;
