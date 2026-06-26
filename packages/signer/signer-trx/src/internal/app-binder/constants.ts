export const APP_NAME = "Tron";

// Tron application APDU class byte.
export const LEDGER_CLA = 0xe0;

// Tron application instruction bytes
export const INS = {
  GET_ADDRESS: 0x02,
  SIGN_TRANSACTION: 0x04,
  SIGN_TRANSACTION_HASH: 0x05,
  GET_APP_CONFIGURATION: 0x06,
  SIGN_PERSONAL_MESSAGE: 0x08,
  ECDH_SECRET: 0x0a,
} as const;

// Maximum APDU payload chunk size used by the Tron application.
export const CHUNK_SIZE = 250;
