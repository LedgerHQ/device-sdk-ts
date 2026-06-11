import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { type RequirementInstruction } from "./model";
import {
  OptionalAccountStrategy,
  type ParsedValueFlowPort,
  ValueSource,
} from "./records";
import {
  accountAddressAt,
  resolvePortAccountIndex,
  resolvePubkeyValue,
} from "./valueResolution";

const instruction: RequirementInstruction = {
  programId: "P",
  data: new Uint8Array(),
  accounts: [
    { address: "first" },
    { address: undefined },
    { address: "third" },
  ],
};

describe("accountAddressAt", () => {
  it("returns the resolved address or undefined", () => {
    expect(accountAddressAt(instruction, 0)).toBe("first");
    expect(accountAddressAt(instruction, 1)).toBeUndefined(); // unresolved (ALT)
    expect(accountAddressAt(instruction, 9)).toBeUndefined(); // out of bounds
    expect(accountAddressAt(instruction, -1)).toBeUndefined();
  });
});

describe("resolvePubkeyValue", () => {
  it("encodes a 32-byte CONSTANT", () => {
    const payload = new Uint8Array(32).fill(3);
    expect(
      resolvePubkeyValue(
        { source: ValueSource.CONSTANT, payload },
        instruction,
        DefaultBs58Encoder,
      ),
    ).toBe(DefaultBs58Encoder.encode(payload));
  });

  it("rejects a CONSTANT that is not 32 bytes", () => {
    expect(
      resolvePubkeyValue(
        { source: ValueSource.CONSTANT, payload: new Uint8Array(4) },
        instruction,
        DefaultBs58Encoder,
      ),
    ).toBeUndefined();
  });

  it("resolves an ACCOUNT_PATH to the account address", () => {
    expect(
      resolvePubkeyValue(
        { source: ValueSource.ACCOUNT_PATH, payload: Uint8Array.of(2) },
        instruction,
        DefaultBs58Encoder,
      ),
    ).toBe("third");
  });

  it("returns undefined for ARGUMENT_PATH and empty/out-of-range paths", () => {
    expect(
      resolvePubkeyValue(
        { source: ValueSource.ARGUMENT_PATH, payload: Uint8Array.of(1, 0) },
        instruction,
        DefaultBs58Encoder,
      ),
    ).toBeUndefined();
    expect(
      resolvePubkeyValue(
        { source: ValueSource.ACCOUNT_PATH, payload: new Uint8Array() },
        instruction,
        DefaultBs58Encoder,
      ),
    ).toBeUndefined();
  });
});

describe("resolvePortAccountIndex", () => {
  const makePort = (
    accountIndices: number[],
    optionalAccountStrategy = OptionalAccountStrategy.PROGRAM_ID,
  ): ParsedValueFlowPort => ({ accountIndices, optionalAccountStrategy });

  // `instruction` accounts: [0]="first", [1]=undefined, [2]="third".
  // A separate fixture places the program id "P" in slot 0 for the sentinel
  // cases.
  const withProgramIdInSlot0: RequirementInstruction = {
    programId: "P",
    data: new Uint8Array(),
    accounts: [{ address: "P" }, { address: "second" }],
  };

  it("returns the sole candidate for a single-account port", () => {
    expect(resolvePortAccountIndex(makePort([2]), instruction)).toBe(2);
  });

  it("returns -1 for an empty candidate list", () => {
    expect(resolvePortAccountIndex(makePort([]), instruction)).toBe(-1);
  });

  it("skips a PROGRAM_ID-sentinel non-final candidate", () => {
    // slot 0 holds the program id → unset under PROGRAM_ID strategy.
    expect(
      resolvePortAccountIndex(makePort([0, 1]), withProgramIdInSlot0),
    ).toBe(1);
  });

  it("skips an out-of-range non-final candidate", () => {
    expect(resolvePortAccountIndex(makePort([9, 2]), instruction)).toBe(2);
  });

  it("does not treat the program-id slot as unset under the OMITTED strategy", () => {
    expect(
      resolvePortAccountIndex(
        makePort([0, 1], OptionalAccountStrategy.OMITTED),
        withProgramIdInSlot0,
      ),
    ).toBe(0);
  });

  it("always resolves the final candidate even when it holds the program id", () => {
    expect(
      resolvePortAccountIndex(makePort([9, 0]), withProgramIdInSlot0),
    ).toBe(0);
  });
});
