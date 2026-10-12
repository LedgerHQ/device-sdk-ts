export const HEDERA_CLA = 0xe0 as const;
export const P2_DEFAULT = 0x00 as const;

export const INS = {
  GET_APP_CONFIGURATION: 0x01,
  GET_PUBLIC_KEY: 0x02,
  SIGN_TRANSACTION: 0x04,
} as const;

export const P1 = {
  DEFAULT: 0x00,
  CHECK_ON_DEVICE: 0x00,
  NO_CHECK: 0x01,
} as const;

// The key index is a 4-byte prefix of every keyed request, see https://github.com/LedgerHQ/app-hedera/blob/master/src/hedera.c
export const APDU_SECTION_LENGTH = {
  KEY_INDEX: 4,
  MAX_DATA: 255,
} as const;

export const MAX_TRANSACTION_LENGTH =
  APDU_SECTION_LENGTH.MAX_DATA - APDU_SECTION_LENGTH.KEY_INDEX;
