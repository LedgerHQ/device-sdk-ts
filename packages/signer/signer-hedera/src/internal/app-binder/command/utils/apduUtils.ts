import { type Apdu, type ApduBuilder } from "@ledgerhq/device-management-kit";

import { APDU_SECTION_LENGTH, MAX_TRANSACTION_LENGTH } from "./apduHeaderUtils";

const MAX_KEY_INDEX = 0xffffffff;

export const assertValidKeyIndex = (keyIndex: number): void => {
  if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex > MAX_KEY_INDEX) {
    throw new Error(
      `Invalid Hedera key index ${keyIndex}, expected an unsigned 32-bit integer`,
    );
  }
};

export const assertValidTransactionLength = (
  transactionBody: Uint8Array,
): void => {
  if (transactionBody.length > MAX_TRANSACTION_LENGTH) {
    throw new Error(
      `Hedera transaction is ${transactionBody.length} bytes, the device accepts at most ${MAX_TRANSACTION_LENGTH}`,
    );
  }
};

// The app reads the key index as a little-endian uint32, while ApduBuilder.add32BitUIntToData is big-endian only.
export const encodeKeyIndex = (keyIndex: number): Uint8Array => {
  assertValidKeyIndex(keyIndex);
  const bytes = new Uint8Array(APDU_SECTION_LENGTH.KEY_INDEX);
  new DataView(bytes.buffer).setUint32(0, keyIndex, true);
  return bytes;
};

// ApduBuilder silently drops data that does not fit and only reports it through getErrors().
export const buildApduOrThrow = (builder: ApduBuilder): Apdu => {
  const errors = builder.getErrors();
  if (errors.length > 0) {
    throw new Error(
      `Invalid Hedera APDU: ${errors.map((e) => e.message).join(", ")}`,
    );
  }
  return builder.build();
};
