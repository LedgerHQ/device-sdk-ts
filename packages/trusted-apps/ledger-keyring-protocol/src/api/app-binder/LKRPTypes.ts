import { CommandTags } from "@internal/utils/TLVTags";

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
  parent: string;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

export type LKRPCommandData = Seed | Derive | AddMember | PublishKey;

type Seed = {
  type: CommandTags.Seed;
  topic: Uint8Array | null;
  protocolVersion: number;
  groupKey: Uint8Array;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

type AddMember = {
  type: CommandTags.AddMember;
  name: string;
  publicKey: Uint8Array;
  permissions: number;
};

type PublishKey = {
  type: CommandTags.PublishKey;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  recipient: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

type Derive = {
  type: CommandTags.Derive;
  path: Uint8Array;
  groupKey: Uint8Array;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};
