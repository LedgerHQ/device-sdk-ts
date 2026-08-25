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
 * P2 curve selector. The app rejects a P2 that names no curve, so this is
 * always set.
 */
export const P2_SECP256K1 = 0x40 as const;

/** P2 flag, OR-ed with the curve selector, asking for the chain code. */
export const P2_RETURN_CHAIN_CODE = 0x01 as const;
