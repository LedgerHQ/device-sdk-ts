export type Keypair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

export type JWT = {
  access_token: string;
  permissions: {
    [trustchainId: string]: {
      [path: string]: string[];
    };
  };
};
