import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

export const ZCASH_CLA = 0xe0 as const;

/**
 * APDU max payload in response chunks (see app-zcash-rust `VK_RESPONSE_CHUNK_LEN`).
 */
export const VK_RESPONSE_CHUNK_SIZE = APDU_MAX_PAYLOAD;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
} as const;

export const P2 = {
  DEFAULT: 0x00,
} as const;
