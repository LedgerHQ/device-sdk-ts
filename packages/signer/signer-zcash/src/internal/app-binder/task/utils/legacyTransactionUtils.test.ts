import { describe, expect, it } from "vitest";

import {
  getZcashBranchId,
  getZcashDefaultTransactionVersion,
  type InternalTransaction,
  parseOutputScriptsFromPaymentOutputBlob,
  resolveExpiryHeightBytes,
  serializeTransaction,
  serializeTransactionOutputs,
} from "./legacyTransactionUtils";

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("getZcashDefaultTransactionVersion", () => {
  it("returns v5 transparent version constant", () => {
    expect(getZcashDefaultTransactionVersion()).toEqual(
      Uint8Array.of(0x05, 0x00, 0x00, 0x80),
    );
  });
});

describe("getZcashBranchId", () => {
  it("returns the original branch id for genesis block height 0", () => {
    expect(getZcashBranchId(0)).toEqual(Uint8Array.of(0x19, 0x1b, 0xa8, 0x5b));
  });

  it("returns latest branch id when block height is unknown", () => {
    expect(getZcashBranchId(undefined)).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
    expect(getZcashBranchId(null)).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
  });

  it("switches from NU6 to NU6.1 branch id at activation height", () => {
    expect(getZcashBranchId(3146399)).toEqual(
      Uint8Array.of(0x55, 0x10, 0xe7, 0xc8),
    );
    expect(getZcashBranchId(3146400)).toEqual(
      Uint8Array.of(0xf0, 0x4d, 0xec, 0x4d),
    );
  });

  it("switches from NU6.1 to NU6.2 branch id at activation height", () => {
    expect(getZcashBranchId(3364599)).toEqual(
      Uint8Array.of(0xf0, 0x4d, 0xec, 0x4d),
    );
    expect(getZcashBranchId(3364600)).toEqual(
      Uint8Array.of(0x30, 0xf3, 0x37, 0x54),
    );
  });

  it("switches from NU6.2 to NU6.3 branch id at activation height", () => {
    expect(getZcashBranchId(3428142)).toEqual(
      Uint8Array.of(0x30, 0xf3, 0x37, 0x54),
    );
    expect(getZcashBranchId(3428143)).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
  });
});

describe("parseOutputScriptsFromPaymentOutputBlob", () => {
  it("round-trips serializeTransactionOutputs", () => {
    const blob = serializeTransactionOutputs({
      version: new Uint8Array(4),
      inputs: [],
      outputs: [
        {
          amount: Uint8Array.of(0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
          script: Uint8Array.of(0xaa, 0xbb),
        },
        {
          amount: Uint8Array.of(0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
          script: Uint8Array.of(0xcc),
        },
      ],
    } satisfies InternalTransaction);
    expect(parseOutputScriptsFromPaymentOutputBlob(blob)).toEqual([
      Uint8Array.of(0xaa, 0xbb),
      Uint8Array.of(0xcc),
    ]);
  });

  it("returns null for truncated blob", () => {
    expect(parseOutputScriptsFromPaymentOutputBlob(Uint8Array.of(0x01))).toBe(
      null,
    );
  });
});

describe("serializeTransaction v5 header", () => {
  const v5Version = Uint8Array.of(0x05, 0x00, 0x00, 0x80);
  const oneInput = {
    inputs: [
      {
        prevout: Uint8Array.of(0xaa),
        script: new Uint8Array(0),
        sequence: Uint8Array.of(0xff, 0xff, 0xff, 0xff),
      },
    ],
  };

  it("normalizes an omitted locktime and expiry to 4 zero bytes so the input count is not shifted", () => {
    const serialized = serializeTransaction({
      version: v5Version,
      ...oneInput,
    } satisfies InternalTransaction);

    // version(05000080) | locktime(00000000) | expiry(00000000) |
    // vin_count(01) | prevout(aa) varint_script_len(00) sequence(ffffffff)
    expect(bytesToHex(serialized)).toBe(
      "05000080" + "00000000" + "00000000" + "01" + "aa00ffffffff",
    );
  });

  it("normalizes an empty locktime to 4 zero bytes", () => {
    const serialized = serializeTransaction({
      version: v5Version,
      locktime: new Uint8Array(0),
      nExpiryHeight: Uint8Array.of(0x11, 0x22, 0x33, 0x44),
      ...oneInput,
    } satisfies InternalTransaction);

    expect(bytesToHex(serialized)).toBe(
      "05000080" + "00000000" + "11223344" + "01" + "aa00ffffffff",
    );
  });

  it("passes through a 4-byte locktime and expiry unchanged", () => {
    const serialized = serializeTransaction({
      version: v5Version,
      locktime: Uint8Array.of(0x0a, 0x0b, 0x0c, 0x0d),
      nExpiryHeight: Uint8Array.of(0x11, 0x22, 0x33, 0x44),
      ...oneInput,
    } satisfies InternalTransaction);

    expect(bytesToHex(serialized)).toBe(
      "05000080" + "0a0b0c0d" + "11223344" + "01" + "aa00ffffffff",
    );
  });

  it("throws when expiry width is neither empty nor 4 bytes", () => {
    expect(() =>
      serializeTransaction({
        version: v5Version,
        nExpiryHeight: Uint8Array.of(0x01, 0x02),
        ...oneInput,
      } satisfies InternalTransaction),
    ).toThrow("expiryHeight must be 4 bytes (got 2)");
  });
});

describe("getZcashBranchId per network", () => {
  const OVERWINTER = Uint8Array.of(0x19, 0x1b, 0xa8, 0x5b);

  it.each([
    [3428143, [0x5b, 0x16, 0xa5, 0x37]],
    [3364600, [0x30, 0xf3, 0x37, 0x54]],
    [3146400, [0xf0, 0x4d, 0xec, 0x4d]],
    [2726400, [0x55, 0x10, 0xe7, 0xc8]],
    [1687104, [0xb4, 0xd0, 0xd6, 0xc2]],
    [1046400, [0xa6, 0x75, 0xff, 0xe9]],
    [903000, [0x0b, 0x23, 0xb9, 0xf5]],
    [653600, [0x60, 0x0e, 0xb4, 0x2b]],
    [419200, [0xbb, 0x09, 0xb8, 0x76]],
  ])(
    "mainnet height %i matches with and without explicit network",
    (height, bytes) => {
      expect(getZcashBranchId(height, "mainnet")).toEqual(
        Uint8Array.from(bytes),
      );
      expect(getZcashBranchId(height)).toEqual(Uint8Array.from(bytes));
    },
  );

  it("mainnet has no NU7 entry: far-future height stays on NU6.3", () => {
    expect(getZcashBranchId(5000000, "mainnet")).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
  });

  it.each([
    [
      "NU7",
      4465026,
      [0xd9, 0x0a, 0x19, 0x77],
      4465025,
      [0x5b, 0x16, 0xa5, 0x37],
    ],
    [
      "NU6.3",
      4134000,
      [0x5b, 0x16, 0xa5, 0x37],
      4133999,
      [0x30, 0xf3, 0x37, 0x54],
    ],
    [
      "NU6.2",
      4052000,
      [0x30, 0xf3, 0x37, 0x54],
      4051999,
      [0xf0, 0x4d, 0xec, 0x4d],
    ],
    [
      "NU6.1",
      3536500,
      [0xf0, 0x4d, 0xec, 0x4d],
      3536499,
      [0x55, 0x10, 0xe7, 0xc8],
    ],
    [
      "NU6",
      2976000,
      [0x55, 0x10, 0xe7, 0xc8],
      2975999,
      [0xb4, 0xd0, 0xd6, 0xc2],
    ],
    [
      "NU5",
      1842420,
      [0xb4, 0xd0, 0xd6, 0xc2],
      1842419,
      [0xa6, 0x75, 0xff, 0xe9],
    ],
    [
      "Canopy",
      1028500,
      [0xa6, 0x75, 0xff, 0xe9],
      1028499,
      [0x0b, 0x23, 0xb9, 0xf5],
    ],
    [
      "Heartwood",
      903800,
      [0x0b, 0x23, 0xb9, 0xf5],
      903799,
      [0x60, 0x0e, 0xb4, 0x2b],
    ],
    [
      "Blossom",
      584000,
      [0x60, 0x0e, 0xb4, 0x2b],
      583999,
      [0xbb, 0x09, 0xb8, 0x76],
    ],
    [
      "Sapling",
      280000,
      [0xbb, 0x09, 0xb8, 0x76],
      279999,
      [0x19, 0x1b, 0xa8, 0x5b],
    ],
  ])(
    "testnet %s activates at its height",
    (_name, height, bytes, belowHeight, belowBytes) => {
      expect(getZcashBranchId(height, "testnet")).toEqual(
        Uint8Array.from(bytes),
      );
      expect(getZcashBranchId(belowHeight, "testnet")).toEqual(
        Uint8Array.from(belowBytes),
      );
    },
  );

  it("testnet null and undefined default to NU7", () => {
    expect(getZcashBranchId(null, "testnet")).toEqual(
      Uint8Array.of(0xd9, 0x0a, 0x19, 0x77),
    );
    expect(getZcashBranchId(undefined, "testnet")).toEqual(
      Uint8Array.of(0xd9, 0x0a, 0x19, 0x77),
    );
  });

  it("mainnet null and undefined default to NU6.3", () => {
    expect(getZcashBranchId(null, "mainnet")).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
    expect(getZcashBranchId(undefined, "mainnet")).toEqual(
      Uint8Array.of(0x5b, 0x16, 0xa5, 0x37),
    );
  });

  it("returns the Overwinter branch id below Sapling on both networks", () => {
    expect(getZcashBranchId(0, "mainnet")).toEqual(OVERWINTER);
    expect(getZcashBranchId(419199, "mainnet")).toEqual(OVERWINTER);
    expect(getZcashBranchId(0, "testnet")).toEqual(OVERWINTER);
    expect(getZcashBranchId(279999, "testnet")).toEqual(OVERWINTER);
  });
});

describe("resolveExpiryHeightBytes", () => {
  it("returns 4 zero bytes when expiryHeight is omitted", () => {
    expect(resolveExpiryHeightBytes()).toEqual(new Uint8Array(4));
  });

  it("returns 4 zero bytes when expiryHeight is empty", () => {
    expect(resolveExpiryHeightBytes(new Uint8Array())).toEqual(
      new Uint8Array(4),
    );
  });

  it("copies a 4-byte expiryHeight", () => {
    expect(
      resolveExpiryHeightBytes(new Uint8Array([0x01, 0x02, 0x03, 0x04])),
    ).toEqual(Uint8Array.of(0x01, 0x02, 0x03, 0x04));
  });

  it("throws when expiryHeight length is not 4 bytes", () => {
    expect(() =>
      resolveExpiryHeightBytes(new Uint8Array([0x01, 0x02])),
    ).toThrow("expiryHeight must be 4 bytes (got 2)");
  });
});
