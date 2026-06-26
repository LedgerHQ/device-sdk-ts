import {
  fromCalTokenValue,
  fromCalValue,
  fromCalValueFlowPort,
} from "./fromCal";
import { OptionalAccountStrategy, TokenKind, ValueSource } from "./records";

describe("fromCalValue", () => {
  it("maps CONSTANT hex to its raw bytes", () => {
    const out = fromCalValue({ source: "CONSTANT", data: "00ff10" });
    expect(out.source).toBe(ValueSource.CONSTANT);
    expect(Array.from(out.payload)).toEqual([0x00, 0xff, 0x10]);
  });

  it("maps ACCOUNT_PATH to a single index byte", () => {
    const out = fromCalValue({ source: "ACCOUNT_PATH", account_index: 5 });
    expect(out.source).toBe(ValueSource.ACCOUNT_PATH);
    expect(Array.from(out.payload)).toEqual([5]);
  });

  it("maps ARGUMENT_PATH with an empty payload", () => {
    const out = fromCalValue({ source: "ARGUMENT_PATH", path: { steps: [1] } });
    expect(out.source).toBe(ValueSource.ARGUMENT_PATH);
    expect(out.payload.length).toBe(0);
  });

  it("rejects an unknown VALUE source", () => {
    expect(() => fromCalValue({ source: "WHAT" })).toThrow(
      /unknown VALUE source/,
    );
  });

  it("rejects invalid / missing CONSTANT hex", () => {
    expect(() => fromCalValue({ source: "CONSTANT", data: "zz" })).toThrow(
      /invalid CONSTANT hex/,
    );
    expect(() => fromCalValue({ source: "CONSTANT" })).toThrow(
      /invalid CONSTANT hex/,
    );
  });
});

describe("fromCalTokenValue", () => {
  it("maps a known kind", () => {
    expect(fromCalTokenValue({ kind: "RESOLVE" }).kind).toBe(TokenKind.RESOLVE);
  });

  it("rejects an unknown kind", () => {
    expect(() => fromCalTokenValue({ kind: "NOPE" })).toThrow(
      /unknown token_value kind/,
    );
  });
});

describe("fromCalValueFlowPort optional account strategy", () => {
  it("defaults to PROGRAM_ID when absent", () => {
    expect(
      fromCalValueFlowPort({ account_index: 0 }).optionalAccountStrategy,
    ).toBe(OptionalAccountStrategy.PROGRAM_ID);
  });

  it("maps OMITTED", () => {
    expect(
      fromCalValueFlowPort({
        account_indices: [0, 1],
        optional_account_strategy: "OMITTED",
      }).optionalAccountStrategy,
    ).toBe(OptionalAccountStrategy.OMITTED);
  });

  it("rejects an unknown strategy", () => {
    expect(() =>
      fromCalValueFlowPort({
        account_index: 0,
        optional_account_strategy: "program_id",
      }),
    ).toThrow(/unknown optional_account_strategy/);
  });
});
