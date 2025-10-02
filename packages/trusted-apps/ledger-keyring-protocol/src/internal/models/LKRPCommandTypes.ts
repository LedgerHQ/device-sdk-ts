import { type CommandTags } from "./Tags";
import { type DataToParsedSegment } from "./Types";

export type LKRPCommandData = Seed | AddMember | PublishKey | Derive;

export type LKRPParsedTlvCommand = DataToParsedSegment<LKRPCommandData>;

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

type ParsedTrustedProperties = {
  iv: Uint8Array;
  issuer: Uint8Array;
  xpriv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  commandIv: Uint8Array;
  groupKey: Uint8Array;
  newMember: Uint8Array;
};
