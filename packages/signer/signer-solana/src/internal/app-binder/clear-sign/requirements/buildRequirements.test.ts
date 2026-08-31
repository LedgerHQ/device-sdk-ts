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
} from "./__tests__/fixtures/calBuilders";
import { buildRequirements } from "./buildRequirements";
import { type CalValue, type CalValueFlowPort } from "./calTypes";
import {
  type InstructionDescriptor,
  type MatchedInstruction,
  type RequirementAccount,
} from "./model";
import { TokenKind } from "./records";
import { RequirementsDecodeError } from "./RequirementsError";
import { type EnumVariantSelector } from "./rules";

const EMPTY_CACHE: VariantCache = new Map();
const NO_ENUMS: EnumVariantSelector = () => Right([]);

function account(
  address?: string,
  altRef?: RequirementAccount["altRef"],
  isWritable = false,
): RequirementAccount {
  return { address, altRef, isWritable };
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
  it("emits ALT_RESOLUTION for a hide-rule target and an owner association behind an ALT", () => {
    // Gap: the device dereferences HIDE_RULE.TARGET and both OWNER_ASSOC halves
    // at finalize and refuses to sign when an ALT slot is unresolved.
    const alt = (entryIndex: number): RequirementAccount => ({
      isWritable: false,
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
    // Entry 3 is the IS_SIGNER target, so it graduates to the higher-priority
    // bucket that streams the same ALT_RESOLUTION and then fetches the state.
    // Entry 4 is only the OWNER_ASSOC owner half: resolution and nothing more.
    expect(result.tokenAccountStateAltRefs).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 4 },
    ]);
  });

  it("emits TOKEN_ACCOUNT_STATE_ALT_REF for an ALT-backed IS_SIGNER hide-rule target", () => {
    // Gap: the address is unknown host-side, so the owner map can only be seeded
    // from a state fetched after ALT_RESOLUTION. Without it the predicate
    // evaluates false and the device shows the screens the rule meant to hide.
    // An ALT slot is never a message signer, so the owner map is the only path
    // by which such a target can satisfy IS_SIGNER at all.
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
    expect(result.tokenAccountStateAltRefs).toEqual([
      { altAddress: "ALT", entryIndex: 5 },
    ]);
    // Stripped from the plain bucket: one ALT_RESOLUTION per entry, and the
    // device rejects a second one.
    expect(result.altResolutions).toEqual([]);
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

  it("keeps an ALT-backed ACTIVE_WHEN IS_SIGNER port out of the plain ALT bucket", () => {
    const result = run([
      matched({
        accounts: [account(undefined, { altAddress: "ALT", entryIndex: 2 })],
        descriptor: {
          valueFlowPorts: [
            // NULL kind: no token requirement of its own, so the ACTIVE_WHEN
            // path is the only thing that can emit anything here.
            port(TokenKind.NULL, {
              accountIndex: 0,
              activeWhen: ["IS_SIGNER"],
            }),
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStateAltRefs).toEqual([
      { altAddress: "ALT", entryIndex: 2 },
    ]);
    expect(result.altResolutions).toEqual([]);
  });

  it("emits TOKEN_ACCOUNT_STATE for an IS_SIGNER hide-rule target, unless a TX-derived OWNER_ASSOC covers it", () => {
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
    expect(withoutBinding.tokenAccountStates).toEqual(["ata"]);

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

  it("honours an OWNER_ASSOC declared by another instruction of the transaction", () => {
    // The owner map is transaction-scoped on the device, so a binding declared
    // by the ATA-creation instruction covers a hide rule elsewhere.
    const result = run([
      matched({
        programId: "Ata",
        accounts: [account("ata"), account("owner")],
        descriptor: {
          ownerAssociations: [ownerAssociation(0, accountPathValue(1))],
        },
      }),
      matched({
        programId: "Token",
        accounts: [account("ata")],
        descriptor: {
          hideRules: [
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(0) }),
          ],
        },
      }),
    ]);
    expect(result.tokenAccountStates).toEqual([]);
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
          hideRules: [
            { target: accountPathValue(0) },
            hideRule({ condition: "IS_SIGNER", target: accountPathValue(0) }),
          ],
        },
      }),
    ]);
    // The IS_SIGNER rule routes the entry to the state bucket, which streams
    // the same ALT_RESOLUTION — the undecodable rule still costs nothing.
    expect(result.altResolutions).toEqual([]);
    expect(result.tokenAccountStateAltRefs).toEqual([
      { altAddress: "ALT", entryIndex: 7 },
    ]);
  });
});
