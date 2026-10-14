/** CLA of the Bitcoin app before 2.1.0, of the altcoin apps built on it and of Zcash. */
export const BTC_LEGACY_CLA = 0xe0 as const;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
  CHANGE_PATH: 0xff,
} as const;

export const P2 = {
  DEFAULT: 0x00,
  SEGWIT: 0x02,
  SAPLING: 0x05,
  HASH_INPUT_CONTINUE: 0x80,
} as const;
