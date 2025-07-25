import * as secp from "@noble/secp256k1";

export function randomPrivateKey() {
  return bytesToHex(secp.utils.randomPrivateKey());
}

export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
