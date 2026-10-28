export const APP_NAME = "Polkadot";

export const LEDGER_CLA = 0xf9;

export const INS = {
  GET_ADDRESS: 0x01,
  SIGN_TRANSACTION: 0x02,
  SIGN_RAW: 0x03,
} as const;

export const P2 = {
  ED25519: 0x00,
  ECDSA: 0x02,
} as const;
