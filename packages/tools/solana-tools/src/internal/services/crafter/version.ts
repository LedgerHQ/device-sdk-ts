import { base64StringToBuffer } from "@ledgerhq/device-management-kit";

// SIMD-0385 "Transaction V1": the version byte is 0x81, distinct from both
// legacy (no version prefix byte at all) and v0 (0x80). @solana/web3.js has
// no v1 support at any level, so this check is what routes v1 input to the
// dedicated `V1TransactionCrafterService` instead of the web3.js-based one.
const V1_VERSION_BYTE = 0x81;

/**
 * True when the given base64 input (a bare message or a full transaction) is
 * a SIMD-0385 v1 transaction. Returns `false`, never throws, for invalid
 * base64 or any other input shape — callers that need to reject malformed
 * input do so via the relevant deserializer instead.
 */
export function isV1Transaction(transactionBase64: string): boolean {
  const bytes = base64StringToBuffer(transactionBase64);
  return bytes !== null && bytes[0] === V1_VERSION_BYTE;
}
