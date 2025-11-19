export enum GeneralTags {
  Null = 0x00,
  Int = 0x01,
  Hash = 0x02,
  Signature = 0x03,
  String = 0x04,
  Bytes = 0x05,
  PublicKey = 0x06,
}

export enum CommandTags {
  Seed = 0x10,
  AddMember = 0x11,
  PublishKey = 0x12,
  CloseStream = 0x13,
  EditMember = 0x14,
  Derive = 0x15,
}

const TP_ENCRYPT = 1 << 7;

export enum TPTags {
  IV = 0x00,
  ISSUER = 0x01 | TP_ENCRYPT,
  XPRIV = 0x02 | TP_ENCRYPT,
  EPHEMERAL_PUBLIC_KEY = 0x03,
  COMMAND_IV = 0x04,
  GROUPKEY = 0x05,
  NEW_MEMBER = 0x06 | TP_ENCRYPT,
}

export enum DERSigTags {
  SIGNATURE = 0x30,
  COMPONENT = 0x02,
}
