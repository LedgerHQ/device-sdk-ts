import {
  base64StringToBuffer,
  bufferToBase64String,
  bufferToHexaString,
} from "@ledgerhq/device-management-kit";
import * as secp from "@noble/secp256k1";

export function bytesFromBase64(base64: string): Uint8Array {
  // return Uint8Array.fromBase64(base64) // Not supported in all browsers yet
  const bytes = base64StringToBuffer(base64);
  if (bytes === null) {
    throw new Error(`Invalid Base64 string: ${base64}`);
  }
  return bytes;
}

export function base64FromBytes(bytes: Uint8Array): string {
  // return bytes.toBase64() // Not supported in all browsers yet
  return bufferToBase64String(bytes);
}

export function genIdentity() {
  const priv = secp.utils.randomPrivateKey();
  const pub = secp.getPublicKey(priv, true);
  const clientName = `DMK Playground-${bufferToHexaString(pub).slice(0, 6)}`;
  return { clientName, privateKey: bufferToHexaString(priv) };
}
