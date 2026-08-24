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
