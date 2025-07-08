import { type LKRPCommand } from "./LKRPCommand";
import { type CommandTags } from "./TLVTags";

type LKRPBlockStream = object; // TODO: Replace with actual type

export type Trustchain = {
  [path: string]: LKRPBlockStream;
};

export type LKRPBlockData = {
  parent: string;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

export type LKRPCommandData = Seed | AddMember | PublishKey | Derive;

type Seed = {
  type: CommandTags.Seed;
  topic: Uint8Array;
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
  path: string;
  groupKey: Uint8Array;
  initializationVector: Uint8Array;
  encryptedXpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};
