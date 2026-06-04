import { bytes, tlv } from "./__tests__/fixtures/tlvBuilders";
import { firstTag, firstU8, readTlvEntries } from "./descriptorTlv";
import {
  RequirementsThrow,
  TruncatedDescriptorError,
} from "./RequirementsError";

describe("readTlvEntries", () => {
  it("parses sequential records in order", () => {
    const buffer = bytes(0x01, 0x01, 0xaa, 0x02, 0x02, 0xbb, 0xcc);
    const entries = readTlvEntries(buffer);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ tag: 0x01 });
    expect(Array.from(entries[1]!.value)).toEqual([0xbb, 0xcc]);
  });

  it("decodes DER extended lengths (> 127 bytes)", () => {
    const value = new Uint8Array(200).fill(0x07);
    const entries = readTlvEntries(tlv(0x09, value));
    expect(entries[0]!.value).toHaveLength(200);
  });

  it("throws a typed error on a truncated value", () => {
    let caught: unknown;
    try {
      readTlvEntries(bytes(0x01, 0x05, 0x00)); // claims 5, has 1
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RequirementsThrow);
    expect((caught as RequirementsThrow).error).toBeInstanceOf(
      TruncatedDescriptorError,
    );
  });
});

describe("firstTag / firstU8", () => {
  it("returns the first matching value or undefined", () => {
    const entries = readTlvEntries(concatRecords());
    expect(Array.from(firstTag(entries, 0x02)!)).toEqual([0x42]);
    expect(firstTag(entries, 0x99)).toBeUndefined();
  });

  it("firstU8 returns the first byte or undefined", () => {
    const entries = readTlvEntries(concatRecords());
    expect(firstU8(entries, 0x02)).toBe(0x42);
    expect(firstU8(entries, 0x99)).toBeUndefined();
  });
});

function concatRecords(): Uint8Array {
  return Uint8Array.from([0x01, 0x01, 0x10, 0x02, 0x01, 0x42]);
}
