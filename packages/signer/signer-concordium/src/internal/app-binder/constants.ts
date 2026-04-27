export const APP_NAME = "Concordium";

export const LEDGER_CLA = 0xe0;

export const INS = {
  VERIFY_ADDRESS: 0x00,
  GET_PUBLIC_KEY: 0x01,
  SIGN_TRANSFER: 0x02,
  SIGN_TRANSFER_WITH_SCHEDULE: 0x03,
  SIGN_CREDENTIAL_DEPLOYMENT: 0x04,
  SIGN_TRANSFER_WITH_MEMO: 0x32,
  SIGN_TRANSFER_WITH_SCHEDULE_AND_MEMO: 0x34,
  REGISTER_DATA: 0x35,
  SET_TRUSTED_NAME: 0x22,
  GET_CHALLENGE: 0x23,
  GET_APP_VERSION: 0x40,
} as const;

export const P1 = {
  NON_CONFIRM: 0x01,
  CONFIRM: 0x00,
  FIRST_CHUNK: 0x00,
  INITIAL: 0x00,
  INITIAL_WITH_MEMO: 0x01,
  MEMO: 0x02,
  AMOUNT: 0x03,

  // Credential Deployment
  VERIFICATION_KEY_COUNT: 0x0a,
  VERIFICATION_KEY: 0x01,
  SIGNATURE_THRESHOLD: 0x02,
  AR_IDENTITY: 0x03,
  CREDENTIAL_DATES: 0x04,
  ATTRIBUTE_TAG: 0x05,
  ATTRIBUTE_VALUE: 0x06,
  LENGTH_OF_PROOFS: 0x07,
  PROOFS: 0x08,
  NEW_OR_EXISTING: 0x09,
  FULL_PATH: 0x02,
} as const;

export const P2 = {
  NONE: 0x00,
  MORE: 0x80,
  LAST: 0x00,
  // Set on the final SIGN_TRANSFER / initial SIGN_TRANSFER_WITH_MEMO APDU to
  // request that the device display the transaction fee during signing.
  // When set, the 8-byte big-endian µCCD fee MUST be appended to the APDU
  // data (after the normal payload). Requires Concordium app ≥ 5.5.2.
  FEE_DISPLAY: 0x01,
} as const;

/**
 * Minimum Concordium app version that accepts the P2=FEE_DISPLAY APDU
 * extension. Older firmwares reject the non-zero P2 byte, so we gate the
 * feature behind this version check via {@link GetAppConfigCommand}.
 */
export const MIN_FEE_DISPLAY_VERSION = {
  major: 5,
  minor: 5,
  patch: 2,
} as const;
