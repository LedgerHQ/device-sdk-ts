import { decodeTronAddress, encodeTronAddress } from "./tronBase58Check";

const RAW_ADDRESS = Uint8Array.from([
  0x41, 0x88, 0x40, 0xe6, 0xc5, 0x5b, 0x9a, 0xda, 0x32, 0x6d, 0x21, 0x1d, 0x81,
  0x8c, 0x34, 0xa9, 0x94, 0xae, 0xc9, 0xed, 0x80,
]);

describe("Tron base58check", () => {
  it("round-trips a raw Tron address", () => {
    const encoded = encodeTronAddress(RAW_ADDRESS);

    expect(decodeTronAddress(encoded)).toStrictEqual(RAW_ADDRESS);
  });

  it("rejects an invalid checksum", () => {
    const encoded = encodeTronAddress(RAW_ADDRESS);
    const replacement = encoded.endsWith("1") ? "2" : "1";

    expect(
      decodeTronAddress(`${encoded.slice(0, -1)}${replacement}`),
    ).toBeUndefined();
  });

  it("rejects malformed base58", () => {
    expect(decodeTronAddress("not-a-tron-address")).toBeUndefined();
  });
});
