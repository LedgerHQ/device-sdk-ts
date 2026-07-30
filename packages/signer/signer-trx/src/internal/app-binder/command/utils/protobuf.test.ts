import { decodeVarint, getNextLength } from "./protobuf";

describe("decodeVarint", () => {
  it("decodes a single-byte varint and reports the next position", () => {
    const { value, pos } = decodeVarint(Uint8Array.from([0x08]), 0);

    expect(value).toBe(8);
    expect(pos).toBe(1);
  });

  it("decodes a multi-byte varint (150 => 0x96 0x01)", () => {
    const { value, pos } = decodeVarint(Uint8Array.from([0x96, 0x01]), 0);

    expect(value).toBe(150);
    expect(pos).toBe(2);
  });

  it("decodes starting from an arbitrary index", () => {
    // leading 0xff byte is skipped; the varint (300 => 0xac 0x02) starts at 1
    const { value, pos } = decodeVarint(Uint8Array.from([0xff, 0xac, 0x02]), 1);

    expect(value).toBe(300);
    expect(pos).toBe(3);
  });

  it("throws when the varint never terminates (all continuation bits set)", () => {
    const neverTerminating = Uint8Array.from(new Array(10).fill(0x80));

    expect(() => decodeVarint(neverTerminating, 0)).toThrow(
      "Too many bytes when decoding varint.",
    );
  });
});

describe("getNextLength", () => {
  it("returns key+value length for a varint field (wire type 0)", () => {
    // field 1, wire type 0 => key 0x08; value 150 => 0x96 0x01. Total 3 bytes.
    const tx = Uint8Array.from([0x08, 0x96, 0x01]);

    expect(getNextLength(tx)).toBe(3);
  });

  it("returns key+length+payload for a length-delimited field (wire type 2)", () => {
    // field 2, wire type 2 => key 0x12; length 3; payload aa bb cc. Total 5 bytes.
    const tx = Uint8Array.from([0x12, 0x03, 0xaa, 0xbb, 0xcc]);

    expect(getNextLength(tx)).toBe(5);
  });

  it("ignores trailing bytes beyond the first field", () => {
    // same length-delimited field (5 bytes) followed by an unrelated trailing byte
    const tx = Uint8Array.from([0x12, 0x03, 0xaa, 0xbb, 0xcc, 0x99]);

    expect(getNextLength(tx)).toBe(5);
  });
});
