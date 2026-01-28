/**
 * Concatenate multiple Uint8Arrays into one.
 *
 * @param arrays - The arrays to concatenate
 * @returns A new Uint8Array containing all input arrays
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
