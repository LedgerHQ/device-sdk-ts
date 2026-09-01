import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  ActiveWhenPredicate,
  HideCondition,
  OptionalAccountStrategy,
  PARAM_TYPE_TOKEN_AMOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  type ParsedAccountReset,
  type ParsedDisplayField,
  type ParsedHideRule,
  type ParsedInstruction,
  type ParsedOwnerAssociation,
  type ParsedValue,
  type ParsedValueFlowPort,
  TokenKind,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { applyTokenRule } from "./tokenRule";

const EMPTY_INFO = {
  typePool: [],
  rootType: 0,
  mintAssociations: [],
  ownerAssociations: [],
};

/** Build a port, defaulting the candidate list and strategy. */
function port(
  overrides: Partial<ParsedValueFlowPort> & { accountIndex?: number },
): ParsedValueFlowPort {
  const { accountIndex, accountIndices, ...rest } = overrides;
  return {
    accountIndices:
      accountIndices ?? (accountIndex !== undefined ? [accountIndex] : []),
    optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
    activeWhen: [],
    ...rest,
  };
}

/** A PARAM_TOKEN_AMOUNT display field whose TOKEN reference is `token`. */
function tokenAmountField(token: ParsedValue): ParsedDisplayField {
  return { paramType: PARAM_TYPE_TOKEN_AMOUNT, token };
}

function parsed(overrides: {
  valueFlowPorts?: ParsedValueFlowPort[];
  accountResets?: ParsedAccountReset[];
  displayFields?: ParsedDisplayField[];
  hideRules?: ParsedHideRule[];
  ownerAssociations?: ParsedOwnerAssociation[];
}): ParsedInstruction {
  return {
    info: {
      ...EMPTY_INFO,
      ownerAssociations: overrides.ownerAssociations ?? [],
    },
    valueFlowPorts: overrides.valueFlowPorts ?? [],
    accountResets: overrides.accountResets ?? [],
    displayFields: overrides.displayFields ?? [],
    hideRules: overrides.hideRules ?? [],
  };
}

function makeInstruction(
  addresses: (string | undefined)[],
  programId = "P",
): RequirementInstruction {
  return {
    programId,
    accounts: addresses.map((address) => ({ address, isWritable: false })),
    data: new Uint8Array(),
  };
}

/** An instruction whose slot `altIndex` is ALT-backed instead of resolved. */
function withAltSlot(
  instruction: RequirementInstruction,
  altIndex: number,
  entryIndex: number,
): RequirementInstruction {
  const accounts = [...instruction.accounts];
  accounts[altIndex] = {
    isWritable: false,
    altRef: { altAddress: "ALT", entryIndex },
  };
  return { ...instruction, accounts };
}

function accountPathValue(index: number): ParsedValue {
  return {
    source: ValueSource.ACCOUNT_PATH,
    payload: Uint8Array.of(index),
  };
}

function isSignerRule(target: ParsedValue): ParsedHideRule {
  return { ruleSetIndex: 0, condition: HideCondition.IS_SIGNER, target };
}

function run(
  records: ParsedInstruction,
  instruction: RequirementInstruction,
  mints: Map<string, string> = new Map(),
  owners: Map<string, string> = new Map(),
) {
  const accumulator = new RequirementAccumulator();
  applyTokenRule(records, instruction, { mints, owners }, accumulator);
  return accumulator.build();
}

describe("applyTokenRule", () => {
  describe("DIRECT port", () => {
    it("emits TOKEN_INFO for a 32-byte constant mint", () => {
      const mint = new Uint8Array(32).fill(4);
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.DIRECT,
                value: { source: ValueSource.CONSTANT, payload: mint },
              },
            }),
          ],
        }),
        makeInstruction(["a"]),
      );
      expect(result.tokenInfos).toEqual([DefaultBs58Encoder.encode(mint)]);
    });

    it("ignores a constant that is not 32 bytes", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.DIRECT,
                value: {
                  source: ValueSource.CONSTANT,
                  payload: new Uint8Array(8),
                },
              },
            }),
          ],
        }),
        makeInstruction(["a"]),
      );
      expect(result.tokenInfos).toEqual([]);
    });

    it("resolves an ACCOUNT_PATH mint to the account address", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.DIRECT,
                value: {
                  source: ValueSource.ACCOUNT_PATH,
                  payload: Uint8Array.of(1),
                },
              },
            }),
          ],
        }),
        makeInstruction(["acct", "theMint"]),
      );
      expect(result.tokenInfos).toEqual(["theMint"]);
    });

    it("ignores an out-of-bounds ACCOUNT_PATH index", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.DIRECT,
                value: {
                  source: ValueSource.ACCOUNT_PATH,
                  payload: Uint8Array.of(9),
                },
              },
            }),
          ],
        }),
        makeInstruction(["a"]),
      );
      expect(result.tokenInfos).toEqual([]);
    });
  });

  describe("RESOLVE port", () => {
    it("sends TOKEN_ACCOUNT_STATE when no MINT_ASSOC binding covers it", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        makeInstruction(["userAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["userAta"]);
      expect(result.tokenInfos).toEqual([]);
    });

    it("emits TOKEN_INFO and skips account-state when MINT_ASSOC binds it", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        makeInstruction(["createdAta"]),
        new Map([["createdAta", "boundMint"]]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenInfos).toEqual(["boundMint"]);
    });

    it("uses the explicit token account index overrides the port's own", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: { kind: TokenKind.RESOLVE, accountIndex: 1 },
            }),
          ],
        }),
        makeInstruction(["wrong", "rightAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["rightAta"]);
    });

    it("resolves a candidate-array port to its first provided candidate", () => {
      // First candidate (index 0) holds the program id under PROGRAM_ID
      // strategy, so it is unset; the next provided candidate (index 1) wins.
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndices: [0, 1],
              tokenValue: { kind: TokenKind.RESOLVE },
            }),
          ],
        }),
        makeInstruction(["P", "realAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["realAta"]);
    });

    it("adds nothing for an unresolved slot that carries no ALT ref either", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        makeInstruction([undefined]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAccountStateAltRefs).toEqual([]);
      expect(result.tokenInfos).toEqual([]);
    });

    it("routes an ALT-backed token account to tokenAccountStateAltRefs", () => {
      // No MINT_ASSOC binding can cover an ALT-backed slot (both halves must be
      // resolved host-side), so the mint can only come from the attested state,
      // fetched once ALT_RESOLUTION names the address.
      const result = run(
        parsed({
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 4),
      );
      expect(result.tokenAccountStateAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 4 },
      ]);
      expect(result.tokenAccountStates).toEqual([]);
    });
  });

  it("ignores NATIVE and NULL ports and ports without a token value", () => {
    const result = run(
      parsed({
        valueFlowPorts: [
          port({ accountIndex: 0, tokenValue: { kind: TokenKind.NATIVE } }),
          port({ accountIndex: 0, tokenValue: { kind: TokenKind.NULL } }),
          port({ accountIndex: 0 }),
        ],
      }),
      makeInstruction(["a"]),
    );
    expect(result.tokenInfos).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  describe("ACCOUNT_RESET", () => {
    it("forces TOKEN_ACCOUNT_STATE when requirePreBalanceZero is set", () => {
      const result = run(
        parsed({
          accountResets: [{ accountIndex: 0, requirePreBalanceZero: true }],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual(["ata"]);
    });

    it("does nothing without the flag or for an out-of-bounds index", () => {
      const noFlag = run(
        parsed({
          accountResets: [{ accountIndex: 0, requirePreBalanceZero: false }],
        }),
        makeInstruction(["ata"]),
      );
      expect(noFlag.tokenAccountStates).toEqual([]);

      const oob = run(
        parsed({
          accountResets: [{ accountIndex: 9, requirePreBalanceZero: true }],
        }),
        makeInstruction(["ata"]),
      );
      expect(oob.tokenAccountStates).toEqual([]);
    });
  });

  describe("PARAM_TOKEN_AMOUNT display field", () => {
    it("emits TOKEN_INFO for a constant-mint amount-formatter token", () => {
      const mint = new Uint8Array(32).fill(9);
      const result = run(
        parsed({
          displayFields: [
            tokenAmountField({ source: ValueSource.CONSTANT, payload: mint }),
          ],
        }),
        makeInstruction(["a"]),
      );
      expect(result.tokenInfos).toEqual([DefaultBs58Encoder.encode(mint)]);
    });

    it("adds an unbound ACCOUNT_PATH token ref as a tokenAmountRef (try TOKEN_INFO first, fallback TOKEN_ACCOUNT_STATE)", () => {
      const result = run(
        parsed({
          displayFields: [
            tokenAmountField({
              source: ValueSource.ACCOUNT_PATH,
              payload: Uint8Array.of(0),
            }),
          ],
        }),
        makeInstruction(["someMint"]),
      );
      expect(result.tokenInfos).toEqual([]);
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAmountRefs).toEqual(["someMint"]);
    });

    it("redirects a bound token-account reference to its mint", () => {
      const result = run(
        parsed({
          displayFields: [
            tokenAmountField({
              source: ValueSource.ACCOUNT_PATH,
              payload: Uint8Array.of(0),
            }),
          ],
        }),
        makeInstruction(["tokenAccount"]),
        new Map([["tokenAccount", "itsMint"]]),
      );
      expect(result.tokenInfos).toEqual(["itsMint"]);
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("ignores non-token-amount display fields", () => {
      const result = run(
        parsed({
          displayFields: [
            {
              paramType: PARAM_TYPE_TRUSTED_NAME,
              value: {
                source: ValueSource.ACCOUNT_PATH,
                payload: Uint8Array.of(0),
              },
            },
          ],
        }),
        makeInstruction(["addr"]),
      );
      expect(result.tokenInfos).toEqual([]);
    });
  });
  describe("RESOLVE port FALLBACK_ACCOUNT", () => {
    it("emits TOKEN_INFO for the fallback account's address", () => {
      // The device uses the fallback slot's address as the mint verbatim once
      // both binding sources miss, so that address is a mint candidate.
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.RESOLVE,
                accountIndex: 0,
                fallbackAccountIndex: 1,
              },
            }),
          ],
        }),
        makeInstruction(["ephemeralAta", "mintOfLastResort"]),
      );
      expect(result.tokenInfos).toEqual(["mintOfLastResort"]);
      expect(result.tokenAccountStates).toEqual(["ephemeralAta"]);
    });

    it("routes an ALT-backed fallback account to mintAltRefs", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: {
                kind: TokenKind.RESOLVE,
                accountIndex: 0,
                fallbackAccountIndex: 1,
              },
            }),
          ],
        }),
        withAltSlot(makeInstruction(["ata", undefined]), 1, 9),
      );
      expect(result.mintAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 9 },
      ]);
      expect(result.tokenInfos).toEqual([]);
    });

    it("ignores a fallback account on a non-RESOLVE token value", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              tokenValue: { kind: TokenKind.NATIVE, fallbackAccountIndex: 1 },
            }),
          ],
        }),
        makeInstruction(["a", "notAMint"]),
      );
      expect(result.tokenInfos).toEqual([]);
    });
  });

  describe("IS_SIGNER owner attestation (trigger path 3)", () => {
    it("emits TOKEN_ACCOUNT_STATE for an IS_SIGNER hide-rule target", () => {
      const result = run(
        parsed({ hideRules: [isSignerRule(accountPathValue(1))] }),
        makeInstruction(["other", "maybeAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["maybeAta"]);
    });

    it("skips a target already bound by a TX-derived OWNER_ASSOC", () => {
      const result = run(
        parsed({ hideRules: [isSignerRule(accountPathValue(0))] }),
        makeInstruction(["boundAta"]),
        new Map(),
        new Map([["boundAta", "itsOwner"]]),
      );
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("ignores hide rules on any other condition", () => {
      const result = run(
        parsed({
          hideRules: [
            {
              ruleSetIndex: 0,
              condition: HideCondition.CREATED_IN_TRANSACTION,
              target: accountPathValue(0),
            },
          ],
        }),
        makeInstruction(["someAccount"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("emits TOKEN_ACCOUNT_STATE for a port with an IS_SIGNER ACTIVE_WHEN", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 1,
              activeWhen: [ActiveWhenPredicate.IS_SIGNER],
              tokenValue: { kind: TokenKind.NATIVE },
            }),
          ],
        }),
        makeInstruction(["other", "portAccount"]),
      );
      expect(result.tokenAccountStates).toEqual(["portAccount"]);
    });

    it("routes an ALT-backed hide-rule target to tokenAccountStateAltRefs", () => {
      // Without this the owner map stays unseeded, the predicate evaluates
      // false, and the device shows the screens the rule meant to hide.
      const result = run(
        parsed({ hideRules: [isSignerRule(accountPathValue(0))] }),
        withAltSlot(makeInstruction([undefined]), 0, 6),
      );
      expect(result.tokenAccountStateAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 6 },
      ]);
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("routes an ALT-backed IS_SIGNER ACTIVE_WHEN port to tokenAccountStateAltRefs", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              activeWhen: [ActiveWhenPredicate.IS_SIGNER],
              tokenValue: { kind: TokenKind.NATIVE },
            }),
          ],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 7),
      );
      expect(result.tokenAccountStateAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 7 },
      ]);
    });

    it("ignores a constant IS_SIGNER target: a CONSTANT is already an address, never an ALT ref", () => {
      const result = run(
        parsed({
          hideRules: [
            isSignerRule({
              source: ValueSource.CONSTANT,
              payload: new Uint8Array(4),
            }),
          ],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 8),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAccountStateAltRefs).toEqual([]);
    });

    it("ignores a port whose ACTIVE_WHEN carries no IS_SIGNER", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({
              accountIndex: 0,
              activeWhen: [ActiveWhenPredicate.CREATED_IN_TRANSACTION],
              tokenValue: { kind: TokenKind.NATIVE },
            }),
          ],
        }),
        makeInstruction(["portAccount"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
    });
  });
});
