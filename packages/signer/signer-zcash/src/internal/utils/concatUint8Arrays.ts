/**
 * Concatenates one or more Uint8Arrays into a new Uint8Array.
 */
export function concatUint8Arrays(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });

  return buffer;
}
