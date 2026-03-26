export const ZCASH_CLA = 0xe0 as const;

export const INS = {
  GET_TRUSTED_INPUT: 0x42,
} as const;

export const P1 = {
  NO_CHECK_ON_DEVICE: 0x00,
  CHECK_ON_DEVICE: 0x01,
} as const;

export const P2 = {
  FIRST: 0x00,
  NEXT: 0x80,
} as const;
