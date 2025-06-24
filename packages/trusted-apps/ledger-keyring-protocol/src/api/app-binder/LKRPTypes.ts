export type Keypair = {
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
};

export type JWT = {
  token: string;
  expiresAt: number;
};
