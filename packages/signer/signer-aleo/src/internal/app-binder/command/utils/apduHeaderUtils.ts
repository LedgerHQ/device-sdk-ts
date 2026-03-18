export const ALEO_CLA = 0xe0;
export const P2_DEFAULT = 0x00 as const;

export const P2 = {
  FIRST_CHUNK: 0x00,
  NEXT_CHUNK: 0x01,
} as const;

export const INS = {
  GET_APP_VERSION: 0x03,
  GET_ADDRESS: 0x05,
  SIGN_INTENT: 0x06,
  GET_VIEW_KEY: 0x07,
} as const;

export const P1 = {
  SIGN_MODE_ROOT: 0x00,
  SIGN_MODE_NESTED_CALL: 0x01,
  SIGN_MODE_FEE: 0x02,
  CHECK_ON_DEVICE: 0x01,
  NO_CHECK: 0x00,
} as const;
