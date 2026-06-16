import { describe, expect, it } from "vitest";

import {
  getZcashBranchId,
  getZcashDefaultTransactionVersion,
  type InternalTransaction,
  parseOutputScriptsFromPaymentOutputBlob,
  resolveExpiryHeightBytes,
  serializeTransactionOutputs,
} from "./legacyTransactionUtils";

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
      Uint8Array.of(0x30, 0xf3, 0x37, 0x54),
    );
    expect(getZcashBranchId(null)).toEqual(
      Uint8Array.of(0x30, 0xf3, 0x37, 0x54),
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
