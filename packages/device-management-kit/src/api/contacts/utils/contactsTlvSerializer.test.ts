import { ByteArrayBuilder } from "@api/apdu/utils/ByteArrayBuilder";

import {
  CONTACTS_TLV_TAG,
  encodeTlvBuffer,
  packDerivationPath,
} from "./contactsTlvSerializer";

describe("contactsTlvSerializer", () => {
  describe("DERIVATION_PATH tag", () => {
    // Pins the ETH-app 1.23 / BOLOS SDK protocol change (commit 963d72b7):
    // the address-book derivation-path tag moved from 0x21 to 0x69. Sending the
    // old tag makes the on-device TLV parser reject with 0x6A80.
    it("is 0x69 (not the pre-1.23 value 0x21)", () => {
      expect(CONTACTS_TLV_TAG.DERIVATION_PATH).toBe(0x69);
    });

    it("encodes a packed path under tag 0x69", () => {
      const builder = new ByteArrayBuilder();
      const path = packDerivationPath([0x8000002c, 0x8000003c, 0x80000000]);

      encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, path);

      expect(builder.build()).toStrictEqual(
        Uint8Array.from([
          0x69, // DERIVATION_PATH tag
          0x0d, // length: 1 count byte + 3 * 4-byte segments
          0x03, // segment count
          0x80,
          0x00,
          0x00,
          0x2c, // 44'
          0x80,
          0x00,
          0x00,
          0x3c, // 60'
          0x80,
          0x00,
          0x00,
          0x00, // 0'
        ]),
      );
    });
  });
});
