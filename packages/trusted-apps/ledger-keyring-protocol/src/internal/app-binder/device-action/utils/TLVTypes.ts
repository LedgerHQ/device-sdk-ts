// Source: https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#General-purpose-types
export const GeneralPurposeTypes = {
  NULL: 0x00,
  VARINT: 0x01,
  HASH: 0x02,
  SIG: 0x03,
  STRING: 0x04,
  BYTES: 0x05,
  PUBKEY: 0x06,
};

export const TrustedPropertiesTypes = {
  IV: 0x00,
  IssuerPublicKey: 0x81,
  Xpriv: 0x82,
  EphemeralPublicKey: 0x03,
  CommandIV: 0x04,
  GroupKey: 0x05,
  TrustedMember: 0x86,
} as const;
