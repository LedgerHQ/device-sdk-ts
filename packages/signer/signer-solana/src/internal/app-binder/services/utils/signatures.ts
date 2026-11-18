import { SIGNATURE_LENGTH } from "./v1Message";

// Fill byte of the placeholders the signer writes into unsigned slots when it
// wraps a bare message as a transaction.
const PLACEHOLDER_SIGNATURE_FILL = 0x01;

/**
 * True when a signature slot holds no real signature: all zeros (what
 * `@solana/web3.js` and Kit serialize for a missing signature) or the
 * signer's own `0x01`-filled placeholder.
 */
export function isPlaceholderSignature(signature: Uint8Array): boolean {
  const first = signature[0];
  if (first !== 0x00 && first !== PLACEHOLDER_SIGNATURE_FILL) return false;
  return signature.every((byte) => byte === first);
}

/**
 * True when at least one of the `count` signature slots starting at `offset`
 * holds a real signature. Slots past the end of `bytes` are ignored.
 */
export function containsSignature(
  bytes: Uint8Array,
  offset: number,
  count: number,
): boolean {
  for (let i = 0; i < count; i++) {
    const start = offset + i * SIGNATURE_LENGTH;
    const signature = bytes.subarray(start, start + SIGNATURE_LENGTH);
    if (
      signature.length === SIGNATURE_LENGTH &&
      !isPlaceholderSignature(signature)
    ) {
      return true;
    }
  }
  return false;
}
