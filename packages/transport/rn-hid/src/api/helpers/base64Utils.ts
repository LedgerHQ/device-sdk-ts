import {
  base64StringToBuffer,
  bufferToBase64String,
} from "@ledgerhq/device-management-kit";

/**
 * Encodes a Uint8Array to a Base64-encoded string.
 * @param byteArray - The Uint8Array to encode.
 * @returns A Base64-encoded string representing the byte array.
 */
export function uint8ArrayToBase64(byteArray: Uint8Array): string {
  return bufferToBase64String(byteArray);
}

/**
 * Decodes a Base64-encoded string to a Uint8Array.
 * @param base64 - The Base64-encoded string to decode.
 * @returns A Uint8Array representing the decoded byte array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const bytes = base64StringToBuffer(base64);
  if (bytes === null) {
    throw new Error(`Invalid Base64 string: ${base64}`);
  }
  return bytes;
}
