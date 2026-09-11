import {
  fromCalAccountReset,
  fromCalHideRule,
  fromCalOwnerAssociation,
  fromCalTokenValue,
  fromCalValue,
  fromCalValueFlowPort,
} from "./fromCal";
import {
  ActiveWhenPredicate,
  HideCondition,
  OptionalAccountStrategy,
  TokenKind,
  ValueKind,
  ValueSource,
} from "./records";

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

  it("carries FALLBACK_ACCOUNT", () => {
    expect(
      fromCalTokenValue({ kind: "RESOLVE", fallback_account: 5 })
        .fallbackAccountIndex,
    ).toBe(5);
  });
});

describe("fromCalHideRule", () => {
  it("maps a condition name, target and rule-set index", () => {
    const rule = fromCalHideRule({
      rule_set_index: 2,
      target: { source: "ACCOUNT_PATH", account_index: 3 },
      condition: "IS_SIGNER",
    });
    expect(rule.condition).toBe(HideCondition.IS_SIGNER);
    expect(rule.ruleSetIndex).toBe(2);
    expect(rule.target?.source).toBe(ValueSource.ACCOUNT_PATH);
  });

  it("defaults RULE_SET_INDEX to 0", () => {
    expect(fromCalHideRule({ condition: "IS_SIGNER" }).ruleSetIndex).toBe(0);
  });

  it("keeps the target of a rule whose condition is unknown or absent", () => {
    // The device resolves every rule's target, so losing the entry would cost
    // the target's ALT_RESOLUTION and make the device refuse to sign.
    const unknown = fromCalHideRule({
      condition: "SOMETIMES",
      target: { source: "ACCOUNT_PATH", account_index: 4 },
    });
    expect(unknown.condition).toBeUndefined();
    expect(Array.from(unknown.target!.payload)).toEqual([4]);

    const absent = fromCalHideRule({
      target: { source: "ACCOUNT_PATH", account_index: 5 },
    });
    expect(absent.condition).toBeUndefined();
    expect(Array.from(absent.target!.payload)).toEqual([5]);
  });
});

describe("fromCalOwnerAssociation", () => {
  it("maps the bound account and its owner VALUE", () => {
    const association = fromCalOwnerAssociation({
      account_index: 1,
      owner: { source: "ACCOUNT_PATH", account_index: 0 },
    });
    expect(association.accountIndex).toBe(1);
    expect(Array.from(association.owner.payload)).toEqual([0]);
  });
});

describe("fromCalValueFlowPort ACTIVE_WHEN", () => {
  it("defaults to no predicates", () => {
    expect(
      fromCalValueFlowPort({
        account_indices: [0],
        token_value: { kind: "NATIVE" },
      }).activeWhen,
    ).toEqual([]);
  });

  it("maps bare names and MINT_PREDICATE alike", () => {
    expect(
      fromCalValueFlowPort({
        account_indices: [0],
        token_value: { kind: "NATIVE" },
        active_when: ["IS_SIGNER", { kind: "MINT_PREDICATE", mint: "Mint" }],
      }).activeWhen,
    ).toEqual([
      ActiveWhenPredicate.IS_SIGNER,
      ActiveWhenPredicate.MINT_PREDICATE,
    ]);
  });

  it("drops an unknown predicate instead of failing the decode", () => {
    // Nothing host-side evaluates activation, and an unknown name cannot be
    // IS_SIGNER, so dropping it can never under-request a descriptor — whereas
    // rejecting would degrade the whole transaction to blind signing.
    expect(
      fromCalValueFlowPort({
        account_indices: [0],
        token_value: { kind: "NATIVE" },
        active_when: ["IS_LUCKY", "IS_SIGNER"],
      }).activeWhen,
    ).toEqual([ActiveWhenPredicate.IS_SIGNER]);
  });
});

describe("fromCalValueFlowPort optional account strategy", () => {
  it("defaults to PROGRAM_ID when absent", () => {
    expect(
      fromCalValueFlowPort({
        account_indices: [0],
        token_value: { kind: "NATIVE" },
      }).optionalAccountStrategy,
    ).toBe(OptionalAccountStrategy.PROGRAM_ID);
  });

  it("maps OMITTED", () => {
    expect(
      fromCalValueFlowPort({
        account_indices: [0, 1],
        optional_account_strategy: "OMITTED",
        token_value: { kind: "NATIVE" },
      }).optionalAccountStrategy,
    ).toBe(OptionalAccountStrategy.OMITTED);
  });

  it("rejects an unknown strategy", () => {
    expect(() =>
      fromCalValueFlowPort({
        account_indices: [0],
        optional_account_strategy: "program_id",
        token_value: { kind: "NATIVE" },
      }),
    ).toThrow(/unknown optional_account_strategy/);
  });
});

describe("fromCalAccountReset", () => {
  it('maps value_kind "native" with no token', () => {
    const out = fromCalAccountReset({
      account_index: 2,
      value_kind: "native",
    });
    expect(out.accountIndex).toBe(2);
    expect(out.valueKind).toBe(ValueKind.NATIVE);
    expect(out.tokenValue).toBeUndefined();
    expect(out.requireNativePreBalanceZero).toBe(false);
    expect(out.requirePreBalanceZero).toBe(false);
  });

  it('maps value_kind "splToken" with a token reference', () => {
    const out = fromCalAccountReset({
      account_index: 1,
      value_kind: "splToken",
      token: { kind: "RESOLVE", account_index: 3 },
      require_pre_balance_zero: true,
    });
    expect(out.valueKind).toBe(ValueKind.SPL_TOKEN);
    expect(out.tokenValue?.kind).toBe(TokenKind.RESOLVE);
    expect(out.tokenValue?.accountIndex).toBe(3);
    expect(out.requirePreBalanceZero).toBe(true);
  });

  it("maps requireNativePreBalanceZero", () => {
    const out = fromCalAccountReset({
      account_index: 0,
      value_kind: "native",
      require_native_pre_balance_zero: true,
    });
    expect(out.requireNativePreBalanceZero).toBe(true);
  });

  it("rejects a missing value_kind as a decode error", () => {
    expect(() => fromCalAccountReset({ account_index: 0 })).toThrow(
      /unknown or missing ACCOUNT_RESET value_kind/,
    );
  });

  it("rejects an unknown value_kind as a decode error", () => {
    expect(() =>
      fromCalAccountReset({ account_index: 0, value_kind: "erc20" }),
    ).toThrow(/unknown or missing ACCOUNT_RESET value_kind/);
  });

  it("rejects splToken without a token field as a decode error", () => {
    expect(() =>
      fromCalAccountReset({ account_index: 0, value_kind: "splToken" }),
    ).toThrow(/missing the required TOKEN field/);
  });
});
