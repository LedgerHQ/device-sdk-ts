import * as secp from "@noble/secp256k1";

// TODO remove that file
export function genIdentity() {
  const priv = secp.utils.randomPrivateKey();
  const pub = secp.getPublicKey(priv, true);
  const clientName = `DMK test-${bytesToHex(pub).slice(0, 6)}`;
  return { clientName, privateKey: bytesToHex(priv) };
}

export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
