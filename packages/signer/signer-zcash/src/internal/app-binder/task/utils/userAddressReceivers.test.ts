import { InvalidArgumentError } from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  type PcztTransaction,
  type PcztUserAddressReceiver,
} from "@api/model/PcztTransaction";
import {
  bytes,
  bytesToHex,
  sampleIronwoodAction,
  sampleOrchardAction,
  sampleTransparentOutput,
  shieldedUserAddressReceivers,
  transparentUserAddressReceivers,
  UA_ORCHARD_RECEIVER,
  UA_P2PKH_RECEIVER,
  UA_SAPLING_RECEIVER,
  UA_SHIELDED_VALUE_HEX,
  UA_TRANSPARENT_VALUE_HEX,
  v5TransactionWithUserAddressReceivers,
  v6TransactionWithUserAddressReceivers,
} from "@internal/app-binder/task/__fixtures__/pcztFixtures";

import { resolveUserAddressReceivers } from "./userAddressReceivers";

const withOutput = (
  kind: "transparent" | "orchard" | "ironwood",
  receivers: PcztUserAddressReceiver[] | null | undefined,
  extra: object = {},
): PcztTransaction => {
  const base: PcztTransaction = {
    global: v6TransactionWithUserAddressReceivers().global,
    transparentInputs: [],
    transparentOutputs: [],
    orchardBundle: null,
    ironwoodBundle: null,
  };
  if (kind === "transparent") {
    base.transparentOutputs = [
      {
        ...sampleTransparentOutput(),
        userAddressReceivers: receivers,
        ...extra,
      },
    ];
  } else if (kind === "orchard") {
    base.orchardBundle = {
      actions: [{ ...sampleOrchardAction(), userAddressReceivers: receivers }],
      flags: 2,
      valueBalance: 0n,
      anchor: bytes(32, 0),
    };
  } else {
    base.ironwoodBundle = {
      actions: [{ ...sampleIronwoodAction(), userAddressReceivers: receivers }],
      flags: 2,
      valueBalance: 0n,
      anchor: bytes(32, 0),
    };
  }
  return base;
};

const sapling = { typecode: 0x02, receiver: UA_SAPLING_RECEIVER };
const orchard = { typecode: 0x03, receiver: UA_ORCHARD_RECEIVER };
const p2pkh = { typecode: 0x00, receiver: UA_P2PKH_RECEIVER };
const p2sh = { typecode: 0x01, receiver: UA_P2PKH_RECEIVER };

const expectInvalid = (tx: PcztTransaction, pattern: RegExp) => {
  const result = resolveUserAddressReceivers(tx);
  expect(result).toBeInstanceOf(InvalidArgumentError);
  expect((result as InvalidArgumentError).originalError.message).toMatch(
    pattern,
  );
};

describe("resolveUserAddressReceivers", () => {
  it("encodes valid lists on all three kinds", () => {
    const result = resolveUserAddressReceivers({
      ...v5TransactionWithUserAddressReceivers(),
      ironwoodBundle: null,
    });
    if (result instanceof InvalidArgumentError) throw result;
    expect(result.count).toBe(2);
    expect(bytesToHex(result.transparent[0]!)).toBe(UA_TRANSPARENT_VALUE_HEX);
    expect(bytesToHex(result.orchard[0]!)).toBe(UA_SHIELDED_VALUE_HEX);
    expect(result.ironwood).toEqual([]);

    const v6 = resolveUserAddressReceivers(
      v6TransactionWithUserAddressReceivers(),
    );
    if (v6 instanceof InvalidArgumentError) throw v6;
    expect(v6.count).toBe(2);
    expect(v6.orchard[0]).toEqual(new Uint8Array());
    expect(bytesToHex(v6.ironwood[0]!)).toBe(UA_SHIELDED_VALUE_HEX);
  });

  it.each([null, undefined])("gives no value for %s", (value) => {
    for (const kind of ["transparent", "orchard", "ironwood"] as const) {
      const result = resolveUserAddressReceivers(withOutput(kind, value));
      if (result instanceof InvalidArgumentError) throw result;
      expect(result.count).toBe(0);
      expect(result[kind]).toEqual([undefined]);
    }
  });

  it("gives no value when the field is absent", () => {
    const result = resolveUserAddressReceivers({
      ...v5TransactionWithUserAddressReceivers(),
      transparentOutputs: [sampleTransparentOutput()],
      orchardBundle: null,
    });
    if (result instanceof InvalidArgumentError) throw result;
    expect(result.count).toBe(0);
  });

  describe.each(["orchard", "ironwood"] as const)("%s action", (kind) => {
    it("rejects a typecode not allowed (Orchard, unknown)", () => {
      expectInvalid(withOutput(kind, [orchard]), /0x3 is not allowed/);
      expectInvalid(
        withOutput(kind, [{ typecode: 0x04, receiver: bytes(43, 1) }]),
        /0x4 is not allowed/,
      );
    });

    it("rejects a wrong length", () => {
      expectInvalid(
        withOutput(kind, [{ typecode: 0x00, receiver: bytes(19, 1) }]),
        /requires 20 bytes, got 19/,
      );
      expectInvalid(
        withOutput(kind, [{ typecode: 0x02, receiver: bytes(44, 1) }]),
        /requires 43 bytes, got 44/,
      );
    });

    it("rejects out of order, duplicate, and P2PKH with P2SH", () => {
      expectInvalid(withOutput(kind, [sapling, p2pkh]), /ascending/);
      expectInvalid(withOutput(kind, [sapling, sapling]), /ascending/);
      expectInvalid(withOutput(kind, [p2pkh, p2sh]), /both be present/);
    });

    it("names the pool and the index", () => {
      expectInvalid(
        withOutput(kind, [orchard]),
        new RegExp(`${kind} output #0`),
      );
    });
  });

  describe("transparent output", () => {
    it("rejects a typecode not allowed (P2PKH, unknown)", () => {
      expectInvalid(withOutput("transparent", [p2pkh]), /0x0 is not allowed/);
      expectInvalid(
        withOutput("transparent", [{ typecode: 0x04, receiver: bytes(43, 1) }]),
        /0x4 is not allowed/,
      );
    });

    it("rejects a wrong length", () => {
      expectInvalid(
        withOutput("transparent", [{ typecode: 0x03, receiver: bytes(44, 1) }]),
        /requires 43 bytes, got 44/,
      );
    });

    it("rejects out of order and duplicate", () => {
      expectInvalid(withOutput("transparent", [orchard, sapling]), /ascending/);
      expectInvalid(withOutput("transparent", [orchard, orchard]), /ascending/);
    });

    it("rejects an empty list", () => {
      expectInvalid(withOutput("transparent", []), /must not be empty/);
    });

    it("rejects a list on a change output with a derivation", () => {
      expectInvalid(
        withOutput("transparent", transparentUserAddressReceivers(), {
          derivation: {
            signingPath: "44'/133'/0'/1/0",
            pubkey: bytes(33, 2),
          },
        }),
        /change output/,
      );
    });

    it("accepts a derivation when no list is given", () => {
      const result = resolveUserAddressReceivers(
        withOutput("transparent", undefined, {
          derivation: { signingPath: "44'/133'/0'/1/0", pubkey: bytes(33, 2) },
        }),
      );
      expect(result).not.toBeInstanceOf(InvalidArgumentError);
    });
  });

  it("accepts the shielded fixture list", () => {
    expect(
      resolveUserAddressReceivers(
        withOutput("orchard", shieldedUserAddressReceivers()),
      ),
    ).not.toBeInstanceOf(InvalidArgumentError);
  });
});
