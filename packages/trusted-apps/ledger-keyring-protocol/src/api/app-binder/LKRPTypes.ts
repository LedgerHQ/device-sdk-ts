export interface Keypair {
  pubKeyToU8a(): Uint8Array;
  pubKeyToHex(): string;
  sign(message: Uint8Array): Promise<Uint8Array>;
  edch(publicKey: Uint8Array): Uint8Array;
}

export type JWT = {
  access_token: string;
  permissions: {
    [trustchainId: string]: {
      [path: string]: string[];
    };
  };
};
