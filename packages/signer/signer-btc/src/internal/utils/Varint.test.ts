import {
  ByteArrayParser,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

import { encodeVarint, extractVarint } from "./Varint";

describe("Varint tests", () => {
  it("Decode empty buffer", () => {
    const parser = new ByteArrayParser(Uint8Array.from([]));
    const extracted = extractVarint(parser);
    expect(extracted.isJust()).toStrictEqual(false);
  });

  it("Decode out of bound bigint", () => {
    const parser = new ByteArrayParser(
      Uint8Array.from([0xff, 0x58, 0xc1, 0x59, 0x7d, 0xa1, 0x83, 0xf5, 0x4b]),
    );
    const extracted = extractVarint(parser);
    expect(extracted.isJust()).toStrictEqual(false);
  });

  it("Decode with buffer too small", () => {
    const parser = new ByteArrayParser(Uint8Array.from([0xff, 0x58, 0xc1]));
    const extracted = extractVarint(parser);
    expect(extracted.isJust()).toStrictEqual(false);
  });

  it("Encode negative number", () => {
    const encoded = encodeVarint(-1);
    expect(encoded.isJust()).toStrictEqual(false);
  });

  it("Encode an unsafe number", () => {
    const encoded = encodeVarint(Number.MAX_SAFE_INTEGER + 1);
    expect(encoded.isJust()).toStrictEqual(false);
  });

  it("Encode an out of bounds big bigint", () => {
    const encoded = encodeVarint(BigInt("0x10000000000000000"));
    expect(encoded.isJust()).toStrictEqual(false);
  });

  // Examples taken from https://wiki.bitcoinsv.io/index.php/VarInt
  it.each([
    [0xbb, "0xBB"],
    [0xff, "0xFDFF00"],
    [0x3419, "0xFD1934"],
    [0xdc4591, "0xFE9145DC00"],
    [0x80081e5, "0xFEE5810008"],
    [0xb4da564e2857, "0xFF57284E56DAB40000"],
    [0x4bf583a17d59c158n, "0xFF58C1597DA183F54B"],
  ])("Encode varint %d into buffer %s", (value, buffer) => {
    const encoded = encodeVarint(value);
    expect(encoded.isJust()).toStrictEqual(true);
    expect(encoded.unsafeCoerce()).toStrictEqual(hexaStringToBuffer(buffer)!);
  });

  // Examples taken from https://wiki.bitcoinsv.io/index.php/VarInt
  it.each([
    ["0xBB", 0xbb, 1],
    ["0xFDFF00", 0xff, 3],
    ["0xFD1934", 0x3419, 3],
    ["0xFE9145DC00", 0xdc4591, 5],
    ["0xFEE5810008", 0x80081e5, 5],
    ["0xFF57284E56DAB40000", 0xb4da564e2857, 9],
  ])(
    "Extract from buffer %s the expected varint %d of size %d",
    (buffer, value, sizeInBytes) => {
      const parser = new ByteArrayParser(hexaStringToBuffer(buffer)!);
      const extracted = extractVarint(parser);
      expect(extracted.isJust()).toStrictEqual(true);
      expect(extracted.unsafeCoerce()).toStrictEqual({ value, sizeInBytes });
    },
  );
});
