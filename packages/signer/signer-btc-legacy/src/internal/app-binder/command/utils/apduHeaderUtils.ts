export const BTC_LEGACY_CLA = 0xe0 as const;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
  CHANGE_PATH: 0xff,
} as const;

export const P2 = {
  DEFAULT: 0x00,
  HASH_INPUT_CONTINUE: 0x80,
} as const;

// The P2 of the 0x44 APDUs that start a new transaction: how the app hashes it.
export const TRANSACTION_TYPE = {
  LEGACY: 0x00,
  BIP143: 0x02,
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
