/**
 * Encodes an unsigned 32-bit integer as 4 big-endian bytes.
 */
export function uint32ToBytesBE(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
  return bytes;
}

/**
 * Encodes an unsigned 32-bit integer as 4 little-endian bytes.
 */
export function uint32ToBytesLE(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}
