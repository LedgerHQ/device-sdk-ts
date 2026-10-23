import { Curve } from "@api/model/Curve";

/**
 * APDU header constants for the XRP application.
 */
export const XRP_CLA = 0xe0 as const;

export const INS = {
  GET_PUBLIC_KEY: 0x02,
  SIGN: 0x04,
  GET_APP_CONFIGURATION: 0x06,
} as const;

export const P1_DEFAULT = 0x00 as const;
export const P2_DEFAULT = 0x00 as const;

/** P1 asking the app to display the address and wait for a confirmation. */
export const P1_DISPLAY = 0x01 as const;

/**
 * P2 curve selectors. The app rejects a P2 that names no curve, or both, so
 * exactly one of them is always set.
 */
export const P2_SECP256K1 = 0x40 as const;
export const P2_ED25519 = 0x80 as const;

/** The P2 curve selector of each curve; adding a curve requires an entry. */
export const P2_BY_CURVE: Record<
  Curve,
  typeof P2_SECP256K1 | typeof P2_ED25519
> = {
  [Curve.Secp256k1]: P2_SECP256K1,
  [Curve.Ed25519]: P2_ED25519,
};

/** P2 flag, OR-ed with the curve selector, asking for the chain code. */
export const P2_RETURN_CHAIN_CODE = 0x01 as const;

/**
 * P1 flags for the chunked Sign APDU. The app reads P1 as two bits
 * (`P1_MASK_ORDER` / `P1_MASK_MORE` in its `apdu/constants.h`): the order bit
 * is clear on the first chunk, and the more bit is set while further chunks
 * are still to come.
 */
export const P1_SUBSEQUENT_CHUNK = 0x01 as const;
export const P1_MORE_CHUNKS = 0x80 as const;
