import { encodeDerivationPath } from "./encodeDerivationPath";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("encodeDerivationPath", () => {
  it("encodes the standard Tron path as count byte + big-endian 32-bit elements", () => {
    // "44'/195'/0'/0/0": length byte (05) followed by the five hardened/
    // non-hardened elements as BE32. Golden vector shared with the serializer.
    const encoded = encodeDerivationPath("44'/195'/0'/0/0");

    expect(toHex(encoded)).toBe("058000002c800000c3800000000000000000000000");
  });

  it("writes the element count in the first byte and sizes the buffer to 1 + 4*n", () => {
    const encoded = encodeDerivationPath("44'/195'/0'/0/0");

    expect(encoded[0]).toBe(5);
    expect(encoded.length).toBe(1 + 5 * 4);
  });

  it("encodes each element big-endian (hardened high bit in the leading byte)", () => {
    const encoded = encodeDerivationPath("44'");

    // 44' = 44 | 0x80000000 = 0x8000002c
    expect(encoded[0]).toBe(1);
    expect(encoded.length).toBe(1 + 1 * 4);
    expect(toHex(encoded.slice(1))).toBe("8000002c");
  });

  it("supports shorter paths with a mix of hardened and non-hardened elements", () => {
    const encoded = encodeDerivationPath("44'/195'/0");

    // 05.. count is 3; elements: 0x8000002c 0x800000c3 0x00000000
    expect(encoded[0]).toBe(3);
    expect(toHex(encoded)).toBe("038000002c800000c300000000");
  });
});
