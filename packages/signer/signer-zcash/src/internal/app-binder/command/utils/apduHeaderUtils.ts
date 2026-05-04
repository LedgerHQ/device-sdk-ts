export const ZCASH_CLA = 0xe0 as const;

/**
 * APDU max payload in response chunks (see app-zcash-rust `VK_RESPONSE_CHUNK_LEN`).
 */
export const VK_RESPONSE_CHUNK_SIZE = 255 as const;

export const INS = {
  GET_WALLET_PUBLIC_KEY: 0x40,
  GET_TRUSTED_INPUT: 0x42,
  GET_VK: 0x50,
} as const;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
} as const;

export const P2 = {
  DEFAULT: 0x00,
} as const;

export const P2_VK = {
  UFVK: 0x00,
  ORCHARD_FVK: 0x01,
} as const;
