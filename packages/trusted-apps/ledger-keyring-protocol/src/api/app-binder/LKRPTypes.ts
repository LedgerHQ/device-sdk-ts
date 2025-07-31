export interface Keypair {
  pubKeyToU8a(): Uint8Array;
  pubKeyToHex(): string;
  sign(message: Uint8Array): Promise<Uint8Array>;
  ecdh(publicKey: Uint8Array): Uint8Array;
}

export type JWT = {
  access_token: string;
  permissions: {
    [trustchainId: string]: {
      [path: string]: string[];
    };
  };
};

export enum Permissions {
  KEY_READER = 0x01,
  KEY_CREATOR = 0x02,
  KEY_REVOKER = 0x04,
  ADD_MEMBER = 0x08,
  REMOVE_MEMBER = 0x16,
  CHANGE_MEMBER_PERMISSIONS = 0x32,
  CHANGE_MEMBER_NAME = 0x64,

  MEMBER = 0,
  OWNER = 0xffffffff,
}
