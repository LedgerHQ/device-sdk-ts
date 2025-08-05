import { type ApduParser } from "@ledgerhq/device-management-kit";

import { type TrustedProperty } from "@internal/externalTypes";

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
      case 0x02:
        trustedProperty.xpriv = tag.value;
        break;
      case 0x03:
        trustedProperty.ephemeralPubKey = tag.value;
        break;
      case 0x04:
        trustedProperty.commandIV = tag.value;
        break;
      case 0x05:
        trustedProperty.groupKey = tag.value;
        break;
      case 0x06:
        trustedProperty.newMember = tag.value;
        break;
      default:
        break;
    }

    tag = parser.extractFieldTLVEncoded();
  }

  return trustedProperty;
}
