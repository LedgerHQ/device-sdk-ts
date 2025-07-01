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

export type Trustchain = {
  [path: string]: LKRPBlock[];
};

export interface LKRPBlock {
  toString(): string;
  toU8A(): Uint8Array;
  toHex(): string;
  parse(): LKRPBlockData;
  hash(): Uint8Array;
}

export interface LKRPCommand {
  toString(): string;
  toU8A(): Uint8Array;
  toHex(): string;
  parse(): LKRPCommandData;
  getTrustedMember(): Uint8Array;
}

export type LKRPBlockData = {
  parent: Uint8Array;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

type LKRPCommandData = Seed | Derive | AddMember | PublishKey;

type Seed = {
  type: "seed";
  topic: Uint8Array | null;
  protocolVersion: number;
  groupKey: Uint8Array;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

type Derive = {
  type: "derive";
  path: number[];
  groupKey: Uint8Array;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

type AddMember = {
  type: "addMember";
  name: string;
  publicKey: Uint8Array;
  permissions: number;
};

type PublishKey = {
  type: "publishKey";
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  recipient: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};
