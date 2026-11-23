import { type Either, Right } from "purify-ts";

import {
  type SelectedEnumVariant,
  type VariantCache,
} from "@internal/app-binder/clear-sign/idl-type-pool";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import {
  accountPathValue,
  accountReset,
  bytes,
  constantValue,
  descriptor,
  hideRule,
  idlDescriptor,
  mintAssociation,
  ownerAssociation,
  tokenValue,
  trustedNameDisplayField,
  valueFlowPort,
  witnessedScope,
} from "./__tests__/fixtures/calBuilders";
import { buildRequirements } from "./buildRequirements";
import { type CalValue, type CalValueFlowPort } from "./calTypes";
import {
  type InstructionDescriptor,
  type MatchedInstruction,
  type RequirementAccount,
} from "./model";
import { TokenKind } from "./records";
import {
  AccountSchemaMismatchError,
  RequirementsDecodeError,
} from "./RequirementsError";
import { type EnumVariantSelector } from "./rules";

const EMPTY_CACHE: VariantCache = new Map();
const NO_ENUMS: EnumVariantSelector = () => Right([]);

function account(
  address?: string,
  altRef?: RequirementAccount["altRef"],
  isWritable = false,
): RequirementAccount {
  return { address, altRef, isWritable, isSigner: false };
}

function port(
  kind: TokenKind,
  opts: {
    accountIndex?: number;
    tokenAccountIndex?: number;
    fallbackAccount?: number;
    value?: CalValue;
    activeWhen?: string[];
  } = {},
): CalValueFlowPort {
  const kindName = (["DIRECT", "RESOLVE", "NULL", "NATIVE"] as const)[kind]!;
  return valueFlowPort({
    accountIndex: opts.accountIndex ?? 0,
    activeWhen: opts.activeWhen,
    tokenValue: tokenValue(kindName, {
      accountIndex: opts.tokenAccountIndex,
      fallbackAccount: opts.fallbackAccount,
      value: opts.value,
    }),
  });
}

function matched(opts: {
  programId?: string;
  discriminator?: string;
  accounts: RequirementAccount[];
  data?: Uint8Array;
  descriptor?: Partial<InstructionDescriptor>;
}): MatchedInstruction {
  return {
    instruction: {
      programId: opts.programId ?? "Prog",
      accounts: opts.accounts,
      data: opts.data ?? new Uint8Array(),
    },
    descriptor: descriptor({
      discriminator: opts.discriminator ?? "00",
      enumCache: EMPTY_CACHE,
      ...opts.descriptor,
    }),
  };
}

function run(matchedList: MatchedInstruction[], selector = NO_ENUMS) {
  return buildRequirements(matchedList, {
    selectEnumVariants: selector,
  }).unsafeCoerce();
}

describe("buildRequirements", () => {
  it("System transfer: only INSTRUCTION_INFO, native port pulls no token info", () => {
    const result = run([
      matched({
        programId: "11111111111111111111111111111111",
        discriminator: "02000000",
        accounts: [account("from"), account("to")],
        descriptor: {
          valueFlowPorts: [port(TokenKind.NATIVE, { accountIndex: 0 })],
        },
      }),
    ]);
    expect(result.instructionInfos).toEqual([
      {
        programId: "11111111111111111111111111111111",
        discriminator: "02000000",
      },
    ]);
    expect(result.tokenInfos).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("DIRECT port: a constant mint becomes a TOKEN_INFO", () => {
    const mintBytes = new Uint8Array(32).fill(9);
    const result = run([
      matched({
        accounts: [account("a")],
        descriptor: {
          valueFlowPorts: [
            port(TokenKind.DIRECT, { value: constantValue(mintBytes) }),
          ],
        },
      }),
    ]);
    expect(result.tokenInfos).toEqual([DefaultBs58Encoder.encode(mintBytes)]);
  });

  it("DIRECT port: an ACCOUNT_PATH mint resolves to the account address", () => {
    const result = run([
      matched({
        accounts: [account("tokenAcct"), account("theMint")],
        descriptor: {
          valueFlowPorts: [
            port(TokenKind.DIRECT, { value: accountPathValue(1) }),
          ],
        },
      }),
    ]);
    expect(result.tokenInfos).toEqual(["theMint"]);
  });

  it("RESOLVE port not covered by MINT_ASSOC: sends TOKEN_ACCOUNT_STATE", () => {
    const result = run([
      matched({
        accounts: [account("userAta")],
        descriptor: {
          valueFlowPorts: [
            port(TokenKind.RESOLVE, { accountIndex: 0, tokenAccountIndex: 0 }),
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual(["userAta"]);
    expect(result.tokenInfos).toEqual([]);
  });

  it("RESOLVE port with a single-account candidate list resolves the token account", () => {
    const result = run([
      matched({
        accounts: [account("userAta")],
        descriptor: {
          // The common single-account port is a 1-element `account_indices` list.
          valueFlowPorts: [
            { account_indices: [0], token_value: { kind: "RESOLVE" } },
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual(["userAta"]);
  });

  it("RESOLVE port covered by MINT_ASSOC: emits TOKEN_INFO, skips account-state", () => {
    const result = run([
      matched({
        accounts: [account("createdAta"), account("theMint")],
        descriptor: {
          mintAssociations: [mintAssociation(0, 1)],
          valueFlowPorts: [
            port(TokenKind.RESOLVE, { accountIndex: 0, tokenAccountIndex: 0 }),
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual([]);
    expect(result.tokenInfos).toEqual(["theMint"]);
  });

  it("NULL port pulls no token requirements", () => {
    const result = run([
      matched({
        accounts: [account("x")],
        descriptor: { valueFlowPorts: [port(TokenKind.NULL)] },
      }),
    ]);
    expect(result.tokenInfos).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("ACCOUNT_RESET with requirePreBalanceZero forces a TOKEN_ACCOUNT_STATE", () => {
    const result = run([
      matched({
        accounts: [account("ata")],
        descriptor: {
          accountResets: [
            accountReset({ accountIndex: 0, requirePreBalanceZero: true }),
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual(["ata"]);
  });

  it("ACCOUNT_RESET without the flag adds nothing", () => {
    const result = run([
      matched({
        accounts: [account("ata")],
        descriptor: { accountResets: [accountReset({ accountIndex: 0 })] },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("multiple resets sharing one account_index are each kept (no deduplication)", () => {
    // CAL spec: one reset per claimed domain; several resets may share one
    // account_index. Nothing in buildRequirements should deduplicate them.
    const result = run([
      matched({
        accounts: [account("ata")],
        descriptor: {
          accountResets: [
            accountReset({
              accountIndex: 0,
              valueKind: "NATIVE",
              requirePreBalanceZero: true,
            }),
            accountReset({
              accountIndex: 0,
              valueKind: "SPL_TOKEN",
              requirePreBalanceZero: true,
              token: { kind: "DIRECT" },
            }),
          ],
        },
      }),
    ]);
    // Both resets target the same account but represent different domains; the
    // fetched TOKEN_ACCOUNT_STATE is deduped in the accumulator (one fetch),
    // but the requirement was placed by each reset independently.
    expect(result.tokenAccountStates).toEqual(["ata"]);
  });

  it("emits ALT_RESOLUTION only for accounts referenced by DISPLAY_FIELD ACCOUNT_PATH or MINT_ASSOC", () => {
    const result = run([
      matched({
        accounts: [
          account("staticKey"),
          account(undefined, { altAddress: "ALT", entryIndex: 3 }),
          account(undefined, { altAddress: "ALT", entryIndex: 9 }), // unreferenced
        ],
        descriptor: {
          // account[1] is referenced by a display field → emitted
          displayFields: [trustedNameDisplayField(accountPathValue(1))],
          // account[2] is not referenced by any display field or MINT_ASSOC → excluded
        },
      }),
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
  });

  it("routes a read-only ALT mint from MINT_ASSOCIATION to mintAltRefs", () => {
    const result = run([
      matched({
        accounts: [
          account(undefined, { altAddress: "ALT", entryIndex: 4 }), // token account
          account(undefined, { altAddress: "ALT", entryIndex: 6 }), // mint, read-only
        ],
        descriptor: { mintAssociations: [mintAssociation(0, 1)] },
      }),
    ]);
    // The mint stays out of altResolutions: the provide phase holds it and
    // conditionally streams TOKEN_INFO after the 0x6d10 signal.
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 4 },
    ]);
    expect(result.mintAltRefs).toEqual([{ altAddress: "ALT", entryIndex: 6 }]);
  });

  it("emits ALT_RESOLUTION for a writable ALT account named by no descriptor field", () => {
    const result = run([
      matched({
        accounts: [
          account("staticKey"),
          account(undefined, { altAddress: "ALT", entryIndex: 3 }, true),
          account(undefined, { altAddress: "ALT", entryIndex: 9 }), // read-only
        ],
      }),
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
  });

  it("emits TRUSTED_NAME for PARAM_TRUSTED_NAME fields (account path + constant)", () => {
    const constantAddr = new Uint8Array(32).fill(5);
    const result = run([
      matched({
        accounts: [account("ignored"), account("namedAccount")],
        descriptor: {
          displayFields: [
            trustedNameDisplayField(accountPathValue(1)),
            trustedNameDisplayField(constantValue(constantAddr)),
          ],
        },
      }),
    ]);
    expect(result.trustedNames).toEqual([
      "namedAccount",
      DefaultBs58Encoder.encode(constantAddr),
    ]);
  });

  it("decodes selected enum variants via the default decoder", () => {
    // pool: [0] STRUCT{ref 1}, [1] ENUM disc=U8 enum_id="k"; data selects variant 2.
    const typePool = [
      { index: 0, kind: "STRUCT", refs: [1] },
      {
        index: 1,
        kind: "ENUM",
        disc_kind: "U8",
        total_variants: 9,
        enum_id: "k",
      },
    ];
    const result = buildRequirements([
      matched({
        programId: "P",
        accounts: [],
        data: bytes(2),
        descriptor: { idlDescriptor: idlDescriptor({ typePool, rootType: 0 }) },
      }),
    ]).unsafeCoerce();
    expect(result.enumVariants).toEqual([
      { programId: "P", enumId: "k", variantIndex: 2 },
    ]);
  });

  it("deduplicates across instructions and stays deterministic", () => {
    const usdc = new Uint8Array(32).fill(1);
    const direct = () =>
      matched({
        programId: "P",
        discriminator: "01",
        accounts: [account("a")],
        descriptor: {
          valueFlowPorts: [
            port(TokenKind.DIRECT, { value: constantValue(usdc) }),
          ],
        },
      });
    const result = run([direct(), direct()]);
    expect(result.instructionInfos).toEqual([
      { programId: "P", discriminator: "01" },
    ]);
    expect(result.tokenInfos).toEqual([DefaultBs58Encoder.encode(usdc)]);
  });

  it("Jupiter-like route: enum + two token infos + ALT entry", () => {
    const inMint = new Uint8Array(32).fill(2);
    const outMint = new Uint8Array(32).fill(3);
    const selector: EnumVariantSelector = () =>
      Right([{ enumId: "swap", variantIndex: 46 }] as SelectedEnumVariant[]);
    const result = run(
      [
        matched({
          programId: "JUP",
          discriminator: "e517cb977ae3ad2a",
          accounts: [
            account("inputAta"),
            account("outputAta"),
            account(undefined, { altAddress: "ALT", entryIndex: 7 }),
          ],
          descriptor: {
            valueFlowPorts: [
              port(TokenKind.DIRECT, {
                accountIndex: 0,
                value: constantValue(inMint),
              }),
              port(TokenKind.DIRECT, {
                accountIndex: 1,
                value: constantValue(outMint),
              }),
            ],
          },
        }),
      ],
      selector,
    );
    expect(result.enumVariants).toEqual([
      { programId: "JUP", enumId: "swap", variantIndex: 46 },
    ]);
    expect(result.tokenInfos).toEqual([
      DefaultBs58Encoder.encode(inMint),
      DefaultBs58Encoder.encode(outMint),
    ]);
    // account[2] is ALT-backed but read-only and named by nothing, so it is
    // excluded from altResolutions (the deliberate exclusion of the rule).
    expect(result.altResolutions).toEqual([]);
  });

  it("surfaces a malformed type pool as a typed Left", () => {
    const broken = matched({
      programId: "P",
      accounts: [],
      descriptor: {
        idlDescriptor: {
          type_pool: [{ index: 0, kind: "NOT_A_KIND" }],
          root_type: 0,
        },
      },
    });
    const result: Either<unknown, unknown> = buildRequirements([broken], {
      selectEnumVariants: NO_ENUMS,
    });
    expect(result.isLeft()).toBe(true);
    result.ifLeft((error) =>
      expect(error).toBeInstanceOf(RequirementsDecodeError),
    );
  });

  it("no accountSchema on the descriptor: check is skipped, requirements build normally", () => {
    const result = run([
      matched({
        accounts: [account("a"), account("b")],
        descriptor: { accountSchema: undefined },
      }),
    ]);
    expect(result.instructionInfos).toEqual([
      { programId: "Prog", discriminator: "00" },
    ]);
  });

  it("accountSchema matches the live accounts: requirements build normally", () => {
    const result = run([
      matched({
        accounts: [
          account("a", undefined, false),
          account("b", undefined, true),
        ],
        descriptor: {
          accountSchema: {
            count_min: 2,
            count_max: 2,
            remaining_policy: { signer: "EITHER", writable: "EITHER" },
            slots: [
              { signer: "EITHER", writable: "FORBIDDEN" },
              { signer: "EITHER", writable: "REQUIRED" },
            ],
          },
        },
      }),
    ]);
    expect(result.instructionInfos).toEqual([
      { programId: "Prog", discriminator: "00" },
    ]);
  });

  it("accountSchema mismatch: surfaces a typed AccountSchemaMismatchError Left and short-circuits", () => {
    const broken = matched({
      discriminator: "AA",
      accounts: [account("a")],
      descriptor: {
        accountSchema: {
          count_min: 2,
          count_max: 2,
          remaining_policy: { signer: "EITHER", writable: "EITHER" },
          slots: [],
        },
      },
    });
    const result: Either<unknown, unknown> = buildRequirements([broken], {
      selectEnumVariants: NO_ENUMS,
    });
    expect(result.isLeft()).toBe(true);
    result.ifLeft((error) => {
      expect(error).toBeInstanceOf(AccountSchemaMismatchError);
      expect((error as AccountSchemaMismatchError).originalError.message).toBe(
        "ACCOUNT_SCHEMA mismatch for (AA): account count 1 below COUNT_MIN 2",
      );
    });
  });

  it("accountSchema mismatch on a later instruction still wins over an earlier unrelated decode error", () => {
    // Regression: the ACCOUNT_SCHEMA check used to run interleaved with the
    // per-instruction rules, inside the same loop as the type-pool decode.
    // A decode failure on an earlier instruction returned Left before the
    // loop ever reached a later instruction's accountSchema check, so a
    // stale descriptor was misreported as a plain RequirementsDecodeError
    // instead of AccountSchemaMismatchError — losing the distinct
    // STALE_DESCRIPTOR blind-sign reason downstream.
    const decodeBroken = matched({
      programId: "P",
      discriminator: "01",
      accounts: [],
      descriptor: {
        idlDescriptor: {
          type_pool: [{ index: 0, kind: "NOT_A_KIND" }],
          root_type: 0,
        },
      },
    });
    const schemaBroken = matched({
      discriminator: "AA",
      accounts: [account("a")],
      descriptor: {
        accountSchema: {
          count_min: 2,
          count_max: 2,
          remaining_policy: { signer: "EITHER", writable: "EITHER" },
          slots: [],
        },
      },
    });
    const result: Either<unknown, unknown> = buildRequirements(
      [decodeBroken, schemaBroken],
      { selectEnumVariants: NO_ENUMS },
    );
    expect(result.isLeft()).toBe(true);
    result.ifLeft((error) =>
      expect(error).toBeInstanceOf(AccountSchemaMismatchError),
    );
  });

  it("emits ALT_RESOLUTION for a hide-rule target and an owner association behind an ALT", () => {
    // Gap: the device dereferences HIDE_RULE.TARGET and both OWNER_ASSOC halves
    // at finalize and refuses to sign when an ALT slot is unresolved.
    const alt = (entryIndex: number): RequirementAccount => ({
      isWritable: false,
      isSigner: false,
      altRef: { altAddress: "ALT", entryIndex },
    });
    const result = run([
      matched({
        accounts: [account("signer"), alt(3), alt(4)],
        descriptor: {
          ownerAssociations: [ownerAssociation(1, accountPathValue(2))],
          hideRules: [
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(1) }),
          ],
        },
      }),
    ]);
    // Entry 3 is the IS_SIGNER target and entry 4 the OWNER_ASSOC owner half:
    // both need their resolution and nothing more.
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
      { altAddress: "ALT", entryIndex: 4 },
    ]);
    expect(result.tokenAccountStateAltRefs).toEqual([]);
  });

  it("resolves an ALT-backed IS_SIGNER hide-rule target without fetching its state", () => {
    // The device holds IS_SIGNER only for its own key, never through the owner
    // map, so an attested owner for the target could not change the answer.
    const result = run([
      matched({
        accounts: [account(undefined, { altAddress: "ALT", entryIndex: 5 })],
        descriptor: {
          hideRules: [
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(0) }),
          ],
        },
      }),
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 5 },
    ]);
    expect(result.tokenAccountStateAltRefs).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("emits TOKEN_ACCOUNT_STATE_ALT_REF for an ALT-backed RESOLVE port token account", () => {
    // Same shape for the mint map: an ALT-backed token account can carry no
    // MINT_ASSOC binding, so its mint has to come from the attested state.
    const result = run([
      matched({
        accounts: [account(undefined, { altAddress: "ALT", entryIndex: 1 })],
        descriptor: {
          valueFlowPorts: [port(TokenKind.RESOLVE, { accountIndex: 0 })],
        },
      }),
    ]);
    expect(result.tokenAccountStateAltRefs).toEqual([
      { altAddress: "ALT", entryIndex: 1 },
    ]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("raises nothing for a port's ACTIVE_WHEN, even a predicate the spec has removed", () => {
    // A bundle encoded before ACTIVE_WHEN lost IS_SIGNER still decodes, and the
    // port's account gets only the resolution any port candidate gets.
    const result = run([
      matched({
        accounts: [account(undefined, { altAddress: "ALT", entryIndex: 2 })],
        descriptor: {
          valueFlowPorts: [
            // NULL kind: no token requirement of its own.
            port(TokenKind.NULL, {
              accountIndex: 0,
              activeWhen: ["IS_SIGNER"],
            }),
          ],
        },
      }),
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 2 },
    ]);
    expect(result.tokenAccountStateAltRefs).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("requests no TOKEN_ACCOUNT_STATE for an IS_SIGNER hide-rule target, with or without an OWNER_ASSOC", () => {
    const withoutBinding = run([
      matched({
        accounts: [account("ata")],
        descriptor: {
          hideRules: [
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(0) }),
          ],
        },
      }),
    ]);
    expect(withoutBinding.tokenAccountStates).toEqual([]);

    const withBinding = run([
      matched({
        accounts: [account("ata"), account("owner")],
        descriptor: {
          ownerAssociations: [ownerAssociation(0, accountPathValue(1))],
          hideRules: [
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(0) }),
          ],
        },
      }),
    ]);
    expect(withBinding.tokenAccountStates).toEqual([]);
  });

  it("treats a RESOLVE port's FALLBACK_ACCOUNT address as a mint candidate", () => {
    const result = run([
      matched({
        accounts: [account("ephemeralAta"), account("fallbackMint")],
        descriptor: {
          valueFlowPorts: [
            port(TokenKind.RESOLVE, { accountIndex: 0, fallbackAccount: 1 }),
          ],
        },
      }),
    ]);
    expect(result.tokenInfos).toEqual(["fallbackMint"]);
    expect(result.tokenAccountStates).toEqual(["ephemeralAta"]);
  });
  it("still emits ALT_RESOLUTION for the target of a rule whose condition CAL did not name", () => {
    // The rule's signed TLV reaches the device either way and the device
    // resolves every target, so an undecodable condition must not cost the
    // requirement.
    const result = run([
      matched({
        accounts: [account(undefined, { altAddress: "ALT", entryIndex: 7 })],
        descriptor: {
          hideRules: [{ target: accountPathValue(0) }],
        },
      }),
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 7 },
    ]);
  });

  describe("witnessed RESET_SCOPE", () => {
    const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const ROUTE_WITH_TOKEN_LEDGER = "96564774a75d0e68";
    const alt = (entryIndex: number, isWritable = false) =>
      account(undefined, { altAddress: "ALT", entryIndex }, isWritable);

    /** Jupiter's `setTokenLedger`: [tokenLedger (w), tokenAccount], reset on 1. */
    function setTokenLedger(
      accounts: RequirementAccount[],
      resetScope = witnessedScope(JUPITER, 0, [
        [ROUTE_WITH_TOKEN_LEDGER, 7],
        ["e6798f50779f6aaa", 11],
      ]),
    ): MatchedInstruction {
      return matched({
        programId: JUPITER,
        discriminator: "e455b9704e4f4d02",
        accounts,
        descriptor: {
          accountResets: [
            accountReset({
              accountIndex: 1,
              valueKind: "SPL_TOKEN",
              token: tokenValue("RESOLVE"),
              resetScope,
            }),
          ],
        },
      });
    }

    /** `routeWithTokenLedger`, reading the ledger at slot 7. */
    function routeWithTokenLedger(ledger: RequirementAccount) {
      return matched({
        programId: JUPITER,
        discriminator: ROUTE_WITH_TOKEN_LEDGER,
        data: bytes(0x96, 0x56, 0x47, 0x74, 0xa7, 0x5d, 0x0e, 0x68, 0x00),
        accounts: [
          ...Array.from({ length: 7 }, (_, i) => account(`acc${i}`)),
          ledger,
          account("tail"),
        ],
      });
    }

    it("resolves the route's read-only ALT ledger, which no other rule streams", () => {
      const result = run([
        setTokenLedger([
          account("tokenLedger", undefined, true),
          account("ata"),
        ]),
        routeWithTokenLedger(alt(9)),
      ]);
      expect(result.altResolutions).toEqual([
        { altAddress: "ALT", entryIndex: 9 },
      ]);
      // The reset's own mint comes from its token account (path 4), as before.
      expect(result.tokenAccountStates).toEqual(["ata"]);
    });

    it("streams no consumer slot for a plain scope", () => {
      const result = run([
        setTokenLedger(
          [account("tokenLedger", undefined, true), account("ata")],
          {
            program_id: JUPITER,
            discriminators: [ROUTE_WITH_TOKEN_LEDGER],
          },
        ),
        routeWithTokenLedger(alt(9)),
      ]);
      expect(result.altResolutions).toEqual([]);
    });

    it("falls back on a stale descriptor when WITNESS_RESET_INDEX is out of range", () => {
      const result = buildRequirements(
        [
          setTokenLedger(
            [account("tokenLedger"), account("ata")],
            witnessedScope(JUPITER, 2, [[ROUTE_WITH_TOKEN_LEDGER, 7]]),
          ),
        ],
        { selectEnumVariants: NO_ENUMS },
      );
      expect(result.isLeft()).toBe(true);
      result.ifLeft((error) => {
        expect(error).toBeInstanceOf(AccountSchemaMismatchError);
        expect(error.originalError.message).toMatch(
          /ACCOUNT_RESET mismatch for \(e455b9704e4f4d02\): RESET_SCOPE witness reset_account_index 2/,
        );
      });
    });

    it("falls back on a stale descriptor when a reset's ACCOUNT_INDEX is out of range", () => {
      // The device refuses the transaction at finalize: the descriptor does not
      // describe this instruction.
      const result = buildRequirements(
        [setTokenLedger([account("tokenLedger")])],
        { selectEnumVariants: NO_ENUMS },
      );
      result.ifLeft((error) =>
        expect(error).toBeInstanceOf(AccountSchemaMismatchError),
      );
      expect(result.isLeft()).toBe(true);
    });
  });
});
