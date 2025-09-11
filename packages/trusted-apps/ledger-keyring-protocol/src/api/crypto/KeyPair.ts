export enum SigFormat {
  COMPACT,
  DER,
}

export interface KeyPair {
  id: string;
  sign(data: Uint8Array, format?: SigFormat): Promise<Uint8Array>;
  verify(
    data: Uint8Array,
    signature: Uint8Array,
    format?: SigFormat,
  ): Promise<boolean>;
  deriveSharedSecret(peerPublicKey: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Uint8Array;
  getPublicKeyToHex(): string;
}
