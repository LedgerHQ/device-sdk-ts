/**
 * Encodes a Uint8Array to a Base64-encoded string.
 * @param byteArray - The Uint8Array to encode.
 * @returns A Base64-encoded string representing the byte array.
 */
export function uint8ArrayToBase64(byteArray: Uint8Array): string {
  const binary = byteArray.reduce((acc, byte) => {
    acc += String.fromCharCode(byte);
    return acc;
  }, "");
  return btoa(binary);
}

/**
 * Decodes a Base64-encoded string to a Uint8Array.
 * @param base64 - The Base64-encoded string to decode.
 * @returns A Uint8Array representing the decoded byte array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
