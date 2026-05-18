import { describe, expect, it } from "vitest";

import {
  getZcashBranchId,
  getZcashDefaultTransactionVersion,
  type InternalTransaction,
  parseOutputScriptsFromPaymentOutputBlob,
  serializeTransactionOutputs,
} from "./legacyTransactionUtils";

describe("getZcashDefaultTransactionVersion", () => {
  it("returns v5 transparent version constant", () => {
    expect(getZcashDefaultTransactionVersion()).toEqual(
      Buffer.from([0x05, 0x00, 0x00, 0x80]),
    );
  });
});

describe("getZcashBranchId", () => {
  it("returns the original branch id for genesis block height 0", () => {
    expect(getZcashBranchId(0)).toEqual(Buffer.from([0x19, 0x1b, 0xa8, 0x5b]));
  });

  it("returns latest branch id when block height is unknown", () => {
    expect(getZcashBranchId(undefined)).toEqual(
      Buffer.from([0xf0, 0x4d, 0xec, 0x4d]),
    );
    expect(getZcashBranchId(null)).toEqual(
      Buffer.from([0xf0, 0x4d, 0xec, 0x4d]),
    );
  });

  it("switches from NU6 to NU6.1 branch id at activation height", () => {
    expect(getZcashBranchId(3146399)).toEqual(
      Buffer.from([0x55, 0x10, 0xe7, 0xc8]),
    );
    expect(getZcashBranchId(3146400)).toEqual(
      Buffer.from([0xf0, 0x4d, 0xec, 0x4d]),
    );
  });
});

describe("parseOutputScriptsFromPaymentOutputBlob", () => {
  it("round-trips serializeTransactionOutputs", () => {
    const blob = serializeTransactionOutputs({
      version: Buffer.alloc(4),
      inputs: [],
      outputs: [
        {
          amount: Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
          script: Buffer.from([0xaa, 0xbb]),
        },
        {
          amount: Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
          script: Buffer.from([0xcc]),
        },
      ],
    } satisfies InternalTransaction);
    expect(parseOutputScriptsFromPaymentOutputBlob(blob)).toEqual([
      Buffer.from([0xaa, 0xbb]),
      Buffer.from([0xcc]),
    ]);
  });

  it("returns null for truncated blob", () => {
    expect(parseOutputScriptsFromPaymentOutputBlob(Buffer.from([0x01]))).toBe(
      null,
    );
  });
});
