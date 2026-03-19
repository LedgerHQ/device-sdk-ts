import { type ApduParser } from "@ledgerhq/device-management-kit";

import { type TrustedProperty } from "@internal/externalTypes";

const TAG_XPRIV = 0x02;
const TAG_EPHEMERAL_PUB_KEY = 0x03;
const TAG_COMMAND_IV = 0x04;
const TAG_GROUP_KEY = 0x05;
const TAG_NEW_MEMBER = 0x06;

export function extractTrustedProperty(
  parser: ApduParser,
): Partial<TrustedProperty> {
  const trustedProperty: Partial<TrustedProperty> = {};

  let tag = parser.extractFieldTLVEncoded();
  while (tag && tag.value) {
    switch (tag.tag) {
      case 0x00:
        trustedProperty.iv = tag.value;
        break;
      case 0x01:
        trustedProperty.issuer = tag.value;
        break;
      case TAG_XPRIV:
        trustedProperty.xpriv = tag.value;
        break;
      case TAG_EPHEMERAL_PUB_KEY:
        trustedProperty.ephemeralPubKey = tag.value;
        break;
      case TAG_COMMAND_IV:
        trustedProperty.commandIV = tag.value;
        break;
      case TAG_GROUP_KEY:
        trustedProperty.groupKey = tag.value;
        break;
      case TAG_NEW_MEMBER:
        trustedProperty.newMember = tag.value;
        break;
      default:
        break;
    }

    tag = parser.extractFieldTLVEncoded();
  }

  return trustedProperty;
}
