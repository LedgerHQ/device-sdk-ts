export interface Keypair {
  pubKeyToU8a(): Uint8Array;
  pubKeyToHex(): string;
  sign(message: Uint8Array): Promise<Uint8Array>;
  ecdh(publicKey: Uint8Array): Uint8Array;
}
