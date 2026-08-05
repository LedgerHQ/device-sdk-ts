import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  OptionalAccountStrategy,
  PARAM_TYPE_TOKEN_AMOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  type ParsedAccountReset,
  type ParsedDisplayField,
  type ParsedInstruction,
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
}): ParsedInstruction {
  return {
    info: EMPTY_INFO,
    valueFlowPorts: overrides.valueFlowPorts ?? [],
    accountResets: overrides.accountResets ?? [],
    displayFields: overrides.displayFields ?? [],
  };
}

function makeInstruction(
  addresses: (string | undefined)[],
  programId = "P",
): RequirementInstruction {
  return {
    programId,
    accounts: addresses.map((address) => ({ address })),
    data: new Uint8Array(),
  };
}

function run(
  records: ParsedInstruction,
  instruction: RequirementInstruction,
  bindings: Map<string, string> = new Map(),
) {
  const accumulator = new RequirementAccumulator();
  applyTokenRule(records, instruction, bindings, accumulator);
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

    it("skips when the target account address is unresolved (ALT-supplied)", () => {
      const result = run(
        parsed({
          valueFlowPorts: [
            port({ accountIndex: 0, tokenValue: { kind: TokenKind.RESOLVE } }),
          ],
        }),
        makeInstruction([undefined]),
      );
      expect(result.tokenAccountStates).toEqual([]);
      expect(result.tokenInfos).toEqual([]);
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
});
