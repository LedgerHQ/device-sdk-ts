import { InvalidArgumentError } from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { type PcztTransaction } from "@api/model/PcztTransaction";
import {
  bytes,
  orchardTransactionDeclaringAccount,
  SAMPLE_GLOBAL,
  SAMPLE_GLOBAL_V6,
  sampleIronwoodActionZip32,
  sampleIronwoodBundle,
  sampleOrchardActionZip32,
  sampleOrchardBundle,
  v6TransactionDeclaringAccounts,
  withOutputAccount,
} from "@internal/app-binder/task/__fixtures__/pcztFixtures";

import {
  isAppVersionAtLeast,
  MIN_APP_VERSION_FOR_OUTPUT_ACCOUNT,
  resolveOutputAccounts,
} from "./outputAccountDeclaration";

const orchardWith = (
  ...actions: ReturnType<typeof sampleOrchardActionZip32>[]
): PcztTransaction => ({
  global: SAMPLE_GLOBAL,
  transparentInputs: [],
  transparentOutputs: [],
  orchardBundle: { ...sampleOrchardBundle(), actions },
});

const declaring = (
  path: string,
  extra: Partial<ReturnType<typeof sampleOrchardActionZip32>> = {},
) =>
  orchardWith({
    ...sampleOrchardActionZip32(),
    ...extra,
    outputZip32Derivation: { path },
  });

const expectRefusal = (result: unknown, rule: RegExp) => {
  expect(result).toBeInstanceOf(InvalidArgumentError);
  expect((result as InvalidArgumentError).originalError.message).toMatch(rule);
};

describe("resolveOutputAccounts", () => {
  it("resolves no account for a transaction without declaration", () => {
    expect(
      resolveOutputAccounts({
        global: SAMPLE_GLOBAL,
        transparentInputs: [],
        transparentOutputs: [],
        orchardBundle: null,
      }),
    ).toEqual({ orchard: [], ironwood: [], count: 0 });
    expect(
      resolveOutputAccounts(
        orchardWith({
          ...sampleOrchardActionZip32(),
          outputZip32Derivation: null,
        }),
      ),
    ).toEqual({ orchard: [undefined], ironwood: [], count: 0 });
  });

  it("resolves valid declarations on both pools", () => {
    expect(resolveOutputAccounts(v6TransactionDeclaringAccounts(1, 2))).toEqual(
      {
        orchard: [1],
        ironwood: [2],
        count: 2,
      },
    );
  });

  it("accepts account 100 and an explicit matching seed fingerprint", () => {
    const tx = orchardWith({
      ...withOutputAccount(sampleOrchardActionZip32(), 100),
      outputZip32Derivation: {
        path: "32'/133'/100'",
        seedFingerprint: bytes(32, 0x00),
      },
    });
    expect(resolveOutputAccounts(tx)).toEqual({
      orchard: [100],
      ironwood: [],
      count: 1,
    });
  });

  it("refuses a path with 2 or 4 components", () => {
    expectRefusal(resolveOutputAccounts(declaring("32'/133'")), /exactly 3/);
    expectRefusal(
      resolveOutputAccounts(declaring("32'/133'/1'/0'")),
      /exactly 3/,
    );
  });

  it("refuses a path that cannot be parsed", () => {
    expectRefusal(
      resolveOutputAccounts(declaring("m/32'/133'/1'")),
      /exactly 3/,
    );
  });

  it("refuses an unhardened component", () => {
    expectRefusal(resolveOutputAccounts(declaring("32'/133'/1")), /hardened/);
  });

  it("refuses a purpose other than 32'", () => {
    expectRefusal(
      resolveOutputAccounts(
        declaring("44'/133'/1'", { signingPath: "44'/133'/0'" }),
      ),
      /purpose must be 32'/,
    );
  });

  it("refuses a coin type different from the spend", () => {
    expectRefusal(
      resolveOutputAccounts(declaring("32'/1'/1'")),
      /coin type must match/,
    );
  });

  it("refuses a spend path too short to compare", () => {
    expectRefusal(
      resolveOutputAccounts(declaring("32'/133'/1'", { signingPath: "32'" })),
      /coin type must match/,
    );
  });

  it("refuses a seed fingerprint different from the spend", () => {
    const tx = orchardWith({
      ...sampleOrchardActionZip32(),
      outputZip32Derivation: {
        path: "32'/133'/1'",
        seedFingerprint: bytes(32, 0x01),
      },
    });
    expectRefusal(resolveOutputAccounts(tx), /seed fingerprint/);
  });

  it("treats an omitted fingerprint as 32 zero bytes on both sides", () => {
    const { seedFingerprint: _unused, ...spend } = sampleOrchardActionZip32();
    void _unused;
    const tx = orchardWith({
      ...spend,
      outputZip32Derivation: { path: "32'/133'/1'" },
    });
    expect(resolveOutputAccounts(tx)).toMatchObject({ count: 1 });
  });

  it("refuses account 101", () => {
    expectRefusal(
      resolveOutputAccounts(declaring("32'/133'/101'")),
      /at most 100/,
    );
  });

  it("refuses the account of a real spend", () => {
    expectRefusal(
      resolveOutputAccounts(orchardTransactionDeclaringAccount(0)),
      /account being spent/,
    );
  });

  it("refuses the account of a real spend of the other pool", () => {
    const tx = v6TransactionDeclaringAccounts(1, 2);
    tx.orchardBundle!.actions[0]!.signingPath = "32'/133'/2'";
    expectRefusal(resolveOutputAccounts(tx), /account being spent/);
  });

  it("refuses the account of a dummy spend, which the device pins as the source too", () => {
    const dummy = {
      ...sampleOrchardActionZip32(),
      spendValue: 0n,
      signingPath: "32'/133'/5'",
    };
    const declared = withOutputAccount(sampleOrchardActionZip32(), 5);
    expectRefusal(
      resolveOutputAccounts(orchardWith(dummy, declared)),
      /account being spent/,
    );
  });

  it("refuses the source account when every spend is a dummy", () => {
    const dummy = { ...sampleOrchardActionZip32(), spendValue: 0n };
    const declared = withOutputAccount({ ...dummy }, 0);
    expectRefusal(
      resolveOutputAccounts(orchardWith(dummy, declared)),
      /account being spent/,
    );
  });

  it("refuses 5 distinct accounts across both pools", () => {
    const tx: PcztTransaction = {
      global: SAMPLE_GLOBAL_V6,
      transparentInputs: [],
      transparentOutputs: [],
      orchardBundle: {
        ...sampleOrchardBundle(),
        actions: [1, 2, 3].map((a) =>
          withOutputAccount(sampleOrchardActionZip32(), a),
        ),
      },
      ironwoodBundle: {
        ...sampleIronwoodBundle(),
        actions: [4, 5].map((a) =>
          withOutputAccount(sampleIronwoodActionZip32(), a),
        ),
      },
    };
    expectRefusal(resolveOutputAccounts(tx), /at most 4 distinct/);
  });

  it("accepts 4 distinct accounts and repeated accounts", () => {
    const tx = orchardWith(
      ...[1, 2, 3, 4, 4, 1].map((a) =>
        withOutputAccount(sampleOrchardActionZip32(), a),
      ),
    );
    expect(resolveOutputAccounts(tx)).toMatchObject({ count: 6 });
  });
});

describe("isAppVersionAtLeast", () => {
  const floor = MIN_APP_VERSION_FOR_OUTPUT_ACCOUNT;

  it("pins the first supporting version", () => {
    expect(floor).toBe("3.9.5");
  });

  it.each(["3.9.5", "3.10.0", "4.0.0", "3.9.6"])("accepts %s", (version) => {
    expect(isAppVersionAtLeast(version, floor)).toBe(true);
  });

  it.each(["3.9.4", "3.8.10", "2.99.99"])("rejects %s", (version) => {
    expect(isAppVersionAtLeast(version, floor)).toBe(false);
  });

  it.each(["ironwood", "", "3.9", "3.9.5-dev"])(
    "rejects unparseable %j",
    (version) => {
      expect(isAppVersionAtLeast(version, floor)).toBe(false);
    },
  );

  it("rejects an unparseable floor", () => {
    expect(isAppVersionAtLeast("3.9.5", "x")).toBe(false);
  });
});
