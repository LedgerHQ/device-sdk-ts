import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";

const CHECKSUM_LENGTH = 4;

function checksum(payload: Uint8Array): Uint8Array {
  return sha256(sha256(payload)).subarray(0, CHECKSUM_LENGTH);
}

export function encodeTronAddress(rawAddress: Uint8Array): string {
  const encoded = new Uint8Array(rawAddress.length + CHECKSUM_LENGTH);
  encoded.set(rawAddress);
  encoded.set(checksum(rawAddress), rawAddress.length);
  return bs58.encode(encoded);
}

/** `undefined` when the address is malformed, a bad checksum included. */
export function decodeTronAddress(address: string): Uint8Array | undefined {
  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(address);
  } catch {
    return undefined;
  }

  if (decoded.length <= CHECKSUM_LENGTH) return undefined;

  const payload = decoded.subarray(0, -CHECKSUM_LENGTH);
  const actualChecksum = decoded.subarray(-CHECKSUM_LENGTH);
  const expectedChecksum = checksum(payload);
  if (
    !actualChecksum.every((byte, index) => byte === expectedChecksum[index])
  ) {
    return undefined;
  }

  return payload;
}
