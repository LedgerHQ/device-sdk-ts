import { bufferToHexaString } from "@ledgerhq/device-management-kit";

import { Sha256HasherService } from "./Sha256HasherService";

const sequence = (length: number, byteAt: (index: number) => number) =>
  Uint8Array.from({ length }, (_, index) => byteAt(index) & 0xff);

describe("Sha256HasherService", () => {
  const hasher = new Sha256HasherService();

  // Expected digests computed with an independent SHA-256 implementation
  // (Node.js crypto).
  it.each<[string, Uint8Array, string]>([
    [
      "an empty buffer",
      new Uint8Array(),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ],
    [
      'the FIPS 180-2 "abc" vector',
      new TextEncoder().encode("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ],
    [
      "a merkle leaf (0x00 prefix and data)",
      Uint8Array.from([0, 42, 43]),
      "8a707e40cad3d1070b0a1c87dd362cdf4d546e6d2a7aaf155c798932f71de4ad",
    ],
    [
      "a wallet descriptor",
      new TextEncoder().encode("wpkh(@0/**)"),
      "c8974a0d8bdd29024b2ddb7a7fe8df1d9801b270f4e6c1e7e1011ae39e7c9b00",
    ],
    [
      "55 bytes (largest single-block message)",
      sequence(55, (i) => i),
      "463eb28e72f82e0a96c0a4cc53690c571281131f672aa229e0d45ae59b598b59",
    ],
    [
      "56 bytes (padding spills into a second block)",
      sequence(56, (i) => i),
      "da2ae4d6b36748f2a318f23e7ab1dfdf45acdc9d049bd80e59de82a60895f562",
    ],
    [
      "64 bytes (exactly one block of data)",
      sequence(64, (i) => i),
      "fdeab9acf3710362bd2658cdc9a29e8f9c757fcf9811603a8c447cd1d9151108",
    ],
    [
      "a merkle node (0x01 prefix and two 32-byte hashes)",
      Uint8Array.from([1, ...sequence(64, (i) => i * 7)]),
      "a0865cbc84d40659c5905cfecc22fba856ed71d93aa994a120a452f2c400433a",
    ],
    [
      "1000 bytes (multi-block)",
      sequence(1000, (i) => i * 31 + 7),
      "5097e7d587352f5097062ae679f37bda5802d9f875aba14c8cb4d1a188ada179",
    ],
  ])("hashes %s", (_, input, expected) => {
    const hash = hasher.hash(input);

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash).toHaveLength(32);
    expect(bufferToHexaString(hash, false)).toBe(expected);
  });

  it("hashes only the bytes of a view with a non-zero offset", () => {
    const backing = sequence(48, (i) => i + 84);
    const view = backing.subarray(16, 32);

    expect(bufferToHexaString(hasher.hash(view), false)).toBe(
      "076f819029f2523b31e8dac8270fa3d2ce28c9fcb9eadd96369002499b02e516",
    );
  });

  it("does not modify its input", () => {
    const input = sequence(100, (i) => i);
    const copy = input.slice();

    hasher.hash(input);

    expect(input).toStrictEqual(copy);
  });
});
