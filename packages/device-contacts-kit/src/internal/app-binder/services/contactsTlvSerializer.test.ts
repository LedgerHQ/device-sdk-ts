import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
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

  describe("primitive encoders", () => {
    it("encodes a single-byte TLV (tag < 0x80, length 1)", () => {
      const builder = new ByteArrayBuilder();
      encodeTlvUInt8(builder, CONTACTS_TLV_TAG.STRUCT_TYPE, 0x2d);
      expect(builder.build()).toStrictEqual(
        Uint8Array.from([0x01, 0x01, 0x2d]),
      );
    });

    it("encodes tags >= 0x80 as the 2-byte DER long form [0x81, tag]", () => {
      const builder = new ByteArrayBuilder();
      encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, "AB");
      // Tag 0xf0 -> DER long form [0x81, 0xf0], length 2, ASCII "AB".
      expect(builder.build()).toStrictEqual(
        Uint8Array.from([0x81, 0xf0, 0x02, 0x41, 0x42]),
      );
    });

    it("encodes chainId as minimal big-endian bytes", () => {
      const builder = new ByteArrayBuilder();
      encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, 1n);
      expect(builder.build()).toStrictEqual(
        Uint8Array.from([0x23, 0x01, 0x01]),
      );

      const builder2 = new ByteArrayBuilder();
      encodeTlvChainId(builder2, CONTACTS_TLV_TAG.CHAIN_ID, 56);
      expect(builder2.build()).toStrictEqual(
        Uint8Array.from([0x23, 0x01, 0x38]),
      );
    });

    it("emits DER long-form length for payloads >= 0x80 bytes", () => {
      const builder = new ByteArrayBuilder();
      const value = new Uint8Array(200).fill(0xab);
      encodeTlvBuffer(builder, CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER, value);
      const out = builder.build();
      // tag 0xf2 -> [0x81, 0xf2], then long-form length 0x81 0xc8 (200).
      expect(Array.from(out.slice(0, 4))).toEqual([0x81, 0xf2, 0x81, 0xc8]);
      expect(out.length).toBe(4 + 200);
    });

    it("rejects a non-positive chainId", () => {
      const builder = new ByteArrayBuilder();
      expect(() =>
        encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, 0),
      ).toThrow();
    });
  });
});
