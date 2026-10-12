import { ApduBuilder } from "@ledgerhq/device-management-kit";

import {
  assertValidKeyIndex,
  assertValidTransactionLength,
  buildApduOrThrow,
  encodeKeyIndex,
} from "./apduUtils";

describe("apduUtils", () => {
  describe("encodeKeyIndex", () => {
    it("should encode the key index as a little-endian uint32", () => {
      expect(encodeKeyIndex(0x01020304)).toStrictEqual(
        new Uint8Array([0x04, 0x03, 0x02, 0x01]),
      );
    });

    it("should encode the largest uint32", () => {
      expect(encodeKeyIndex(0xffffffff)).toStrictEqual(
        new Uint8Array([0xff, 0xff, 0xff, 0xff]),
      );
    });
  });

  describe("assertValidKeyIndex", () => {
    it.each([-1, 1.5, 0x100000000, Number.NaN])(
      "should reject %s",
      (keyIndex) => {
        expect(() => assertValidKeyIndex(keyIndex)).toThrow(
          "Invalid Hedera key index",
        );
      },
    );

    it.each([0, 1, 0xffffffff])("should accept %s", (keyIndex) => {
      expect(() => assertValidKeyIndex(keyIndex)).not.toThrow();
    });
  });

  describe("assertValidTransactionLength", () => {
    it("should accept a body that fits next to the key index", () => {
      expect(() =>
        assertValidTransactionLength(new Uint8Array(251)),
      ).not.toThrow();
    });

    it("should reject a body larger than one APDU", () => {
      expect(() => assertValidTransactionLength(new Uint8Array(252))).toThrow(
        "Hedera transaction is 252 bytes, the device accepts at most 251",
      );
    });
  });

  describe("buildApduOrThrow", () => {
    it("should build an APDU without errors", () => {
      const builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0, p2: 0 });

      expect(buildApduOrThrow(builder).getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]),
      );
    });

    it("should throw when the builder dropped overflowing data", () => {
      const builder = new ApduBuilder({
        cla: 0xe0,
        ins: 0x01,
        p1: 0,
        p2: 0,
      }).addBufferToData(new Uint8Array(256));

      expect(() => buildApduOrThrow(builder)).toThrow("Invalid Hedera APDU");
    });
  });
});
