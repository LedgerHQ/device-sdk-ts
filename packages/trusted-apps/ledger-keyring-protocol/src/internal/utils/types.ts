import { type LKRPBlockStream } from "./LKRPBlockStream";
import { type LKRPCommand } from "./LKRPCommand";
import { type CommandTags } from "./TLVTags";

export type Trustchain = {
  [path: string]: LKRPBlockStream;
};

export type EncryptedPublishedKey = {
  encryptedXpriv: Uint8Array;
  initializationVector: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

export type LKRPBlockData = {
  parent: string;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

export type LKRPBlockParsedData = LKRPBlockData & { header: Uint8Array };

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

export type UnsignedCommandData =
  | AddMemberUnsignedData
  | PublishKeyUnsignedData
  | DeriveUnsignedData;

export type AddMemberUnsignedData = AddMember;
type PublishKeyUnsignedData = Pick<PublishKey, "type" | "recipient">;
type DeriveUnsignedData = Pick<Derive, "type" | "path">;

export type ParsedTrustedProperties = {
  iv: Uint8Array;
  issuer: Uint8Array;
  xpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  commandIv: Uint8Array;
  groupKey: Uint8Array;
  newMember: Uint8Array;
};

export type EncryptedCommand =
  | EncryptedDeriveCommand
  | AddMemberUnsignedData
  | EncryptedPublishKeyCommand;

export type EncryptedDeriveCommand = DeriveUnsignedData &
  Pick<
    ParsedTrustedProperties,
    "iv" | "xpriv" | "ephemeralPublicKey" | "commandIv" | "groupKey"
  >;
export type EncryptedPublishKeyCommand = PublishKeyUnsignedData &
  Pick<
    ParsedTrustedProperties,
    "iv" | "xpriv" | "ephemeralPublicKey" | "commandIv"
  >;
