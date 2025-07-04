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
