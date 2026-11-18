import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
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
  ValueKind,
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
    accounts: addresses.map((address) => ({
      address,
      isWritable: false,
      isSigner: false,
    })),
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
    isSigner: false,
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

function hideRule(
  condition: HideCondition,
  target: ParsedValue,
): ParsedHideRule {
  return { ruleSetIndex: 0, condition, target };
}

function run(
  records: ParsedInstruction,
  instruction: RequirementInstruction,
  mints: Map<string, string> = new Map(),
) {
  const accumulator = new RequirementAccumulator();
  applyTokenRule(records, instruction, { mints }, accumulator);
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
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: true,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: false,
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual(["ata"]);
    });

    it("forces TOKEN_ACCOUNT_STATE when requireNativePreBalanceZero is set", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: true,
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual(["ata"]);
    });

    it("does nothing without the flag or for an out-of-bounds index", () => {
      const noFlag = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: false,
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(noFlag.tokenAccountStates).toEqual([]);

      const oob = run(
        parsed({
          accountResets: [
            {
              accountIndex: 9,
              requirePreBalanceZero: true,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: false,
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(oob.tokenAccountStates).toEqual([]);
    });

    it("path 4: adds TOKEN_ACCOUNT_STATE for splToken+RESOLVE reset with no binding and no fallback", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE },
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual(["ata"]);
    });

    it("path 4: skips TOKEN_ACCOUNT_STATE when mint is already bound, emits TOKEN_INFO instead", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE },
            },
          ],
        }),
        makeInstruction(["ata"]),
        new Map([["ata", "MINT"]]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenInfos).toContain("MINT");
    });

    it("path 4: skips TOKEN_ACCOUNT_STATE when fallbackAccountIndex is set", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE, fallbackAccountIndex: 1 },
            },
          ],
        }),
        makeInstruction(["ata", "MINT"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenInfos).toContain("MINT");
    });

    it("path 4: does not trigger for a native reset", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE },
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      // native reset with no pre-balance flags emits nothing from path 4
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("path 4: does not trigger when tokenValue is absent", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("path 4: does not trigger for a splToken reset with a DIRECT token value", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.DIRECT },
            },
          ],
        }),
        makeInstruction(["ata"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("path 4: uses tokenValue.accountIndex instead of reset.accountIndex when set", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE, accountIndex: 1 },
            },
          ],
        }),
        makeInstruction(["wrong", "rightAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["rightAta"]);
    });

    it("path 4: routes an ALT-backed token account to tokenAccountStateAltRefs", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.SPL_TOKEN,
              requireNativePreBalanceZero: false,
              tokenValue: { kind: TokenKind.RESOLVE },
            },
          ],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 7),
      );
      expect(result.tokenAccountStateAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 7 },
      ]);
      expect(result.tokenAccountStates).toEqual([]);
    });

    it("path 2: an ALT-backed account with a pre-balance flag set produces a TAS ALT ref requirement", () => {
      const result = run(
        parsed({
          accountResets: [
            {
              accountIndex: 0,
              requirePreBalanceZero: false,
              valueKind: ValueKind.NATIVE,
              requireNativePreBalanceZero: true,
            },
          ],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 5),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAccountStateAltRefs).toEqual([
        { altAddress: "ALT", entryIndex: 5 },
      ]);
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

  describe("signer hide conditions", () => {
    // The device holds IS_SIGNER only for its own key and IS_ANOTHER_SIGNER only
    // for another key in the signer list. Neither reads the owner-binding map,
    // so an attested TOKEN_ACCOUNT_STATE.OWNER cannot change either answer: a
    // token account bound to the user is still not the user's key.
    it.each([
      ["IS_SIGNER", HideCondition.IS_SIGNER],
      ["IS_ANOTHER_SIGNER", HideCondition.IS_ANOTHER_SIGNER],
    ])("requests no TOKEN_ACCOUNT_STATE for an %s target", (_, condition) => {
      const result = run(
        parsed({ hideRules: [hideRule(condition, accountPathValue(1))] }),
        makeInstruction(["other", "userAta"]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAccountStateAltRefs).toEqual([]);
    });

    it("requests no TOKEN_ACCOUNT_STATE for an ALT-backed IS_SIGNER target", () => {
      // The target's ALT_RESOLUTION comes from the ALT rule, as for any other
      // hide-rule target; nothing graduates it to the state bucket.
      const result = run(
        parsed({
          hideRules: [hideRule(HideCondition.IS_SIGNER, accountPathValue(0))],
        }),
        withAltSlot(makeInstruction([undefined]), 0, 6),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenAccountStateAltRefs).toEqual([]);
    });

    it("leaves the other paths alone: a RESOLVE port on an IS_SIGNER target still gets its state", () => {
      const result = run(
        parsed({
          hideRules: [hideRule(HideCondition.IS_SIGNER, accountPathValue(0))],
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        makeInstruction(["userAta"]),
      );
      expect(result.tokenAccountStates).toEqual(["userAta"]);
    });
  });
});
