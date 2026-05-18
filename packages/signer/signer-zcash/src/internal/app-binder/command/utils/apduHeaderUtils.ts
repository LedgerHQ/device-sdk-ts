export const ZCASH_CLA = 0xe0 as const;

export const INS = {
  GET_WALLET_PUBLIC_KEY: 0x40,
  GET_TRUSTED_INPUT: 0x42,
  START_UNTRUSTED_HASH_TRANSACTION_INPUT: 0x44,
  SIGN_TRANSACTION: 0x48,
  FINALIZE_INPUT: 0x4a,
} as const;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
  CHANGE_PATH: 0xff,
} as const;

export const P2 = {
  DEFAULT: 0x00,
  SAPLING: 0x05,
  HASH_INPUT_CONTINUE: 0x80,
} as const;
