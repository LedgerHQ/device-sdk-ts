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
  idlDescriptor,
  mintAssociation,
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
): RequirementAccount {
  return { address, altRef };
}

function port(
  kind: TokenKind,
  opts: {
    accountIndex?: number;
    tokenAccountIndex?: number;
    value?: CalValue;
  } = {},
): CalValueFlowPort {
  const kindName = (["DIRECT", "RESOLVE", "NULL", "NATIVE"] as const)[kind]!;
  return valueFlowPort({
    accountIndex: opts.accountIndex ?? 0,
    tokenValue: tokenValue(kindName, {
      accountIndex: opts.tokenAccountIndex,
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
    descriptor: {
      discriminator: opts.discriminator ?? "00",
      idlDescriptor: idlDescriptor({}),
      mintAssociations: [],
      valueFlowPorts: [],
      accountResets: [],
      displayFields: [],
      enumCache: EMPTY_CACHE,
      ...opts.descriptor,
    },
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

  it("RESOLVE port with CAL's singular account_index resolves the token account", () => {
    const result = run([
      matched({
        accounts: [account("userAta")],
        descriptor: {
          // Live CAL emits a single `account_index` (not the spec's
          // `account_indices` list); it must still resolve.
          valueFlowPorts: [
            { account_index: 0, token_value: { kind: "RESOLVE" } },
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

  it("emits ALT_RESOLUTION for ALT-supplied accounts only", () => {
    const result = run([
      matched({
        accounts: [
          account("staticKey"),
          account(undefined, { altAddress: "ALT", entryIndex: 3 }),
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
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 7 },
    ]);
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
});
