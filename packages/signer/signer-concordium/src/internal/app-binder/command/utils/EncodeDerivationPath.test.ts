import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";

describe("encodeDerivationPath", () => {
  it("should encode a standard 5-element Concordium path", () => {
    const result = encodeDerivationPath("44'/919'/0'/0'/0'");

    // 1 byte length + 5 * 4 bytes = 21 bytes
    expect(result).toHaveLength(21);

    // First byte: path length
    expect(result[0]).toBe(5);

    const view = new DataView(result.buffer, result.byteOffset);

    // 44' = 44 | 0x80000000 = 0x8000002C
    expect(view.getUint32(1, false)).toBe(0x8000002c);

    // 919' = 919 | 0x80000000 = 0x80000397
    expect(view.getUint32(5, false)).toBe(0x80000397);

    // 0' = 0 | 0x80000000 = 0x80000000
    expect(view.getUint32(9, false)).toBe(0x80000000);
    expect(view.getUint32(13, false)).toBe(0x80000000);
    expect(view.getUint32(17, false)).toBe(0x80000000);
  });

  it("should harden all elements regardless of input", () => {
    // Input without hardening markers — output should still be hardened
    const result = encodeDerivationPath("44/919/0/0/0");
    const view = new DataView(result.buffer, result.byteOffset);

    expect(view.getUint32(1, false)).toBe(0x8000002c);
    expect(view.getUint32(5, false)).toBe(0x80000397);
  });

  it("should encode paths with non-zero identity and credential indices", () => {
    const result = encodeDerivationPath("44'/919'/0'/3'/7'");
    const view = new DataView(result.buffer, result.byteOffset);

    // 3' = 0x80000003
    expect(view.getUint32(13, false)).toBe(0x80000003);

    // 7' = 0x80000007
    expect(view.getUint32(17, false)).toBe(0x80000007);
  });

  it("should use big-endian byte order", () => {
    const result = encodeDerivationPath("44'/919'/0'/0'/0'");

    // 0x8000002C in big-endian: [0x80, 0x00, 0x00, 0x2C]
    expect(result[1]).toBe(0x80);
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0x00);
    expect(result[4]).toBe(0x2c);
  });

  it("should throw on invalid path input", () => {
    expect(() => encodeDerivationPath("m/44'/919'/0'/0'/0'")).toThrow();
  });
});
