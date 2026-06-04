import { type Either, Right } from "purify-ts";

import {
  type SelectedEnumVariant,
  type VariantCache,
} from "@internal/app-binder/clear-sign/idl-type-pool";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import {
  accountReset,
  bytes,
  instructionInfo,
  tokenValue,
  trustedNameDisplayField,
  value,
  valueFlowPort,
} from "./__tests__/fixtures/tlvBuilders";
import { buildRequirements } from "./buildRequirements";
import {
  type MatchedInstruction,
  type RequirementAccount,
  SubstructureKind,
} from "./model";
import { TokenKind, ValueSource } from "./records";
import { MissingInstructionFieldError } from "./RequirementsError";
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
    value?: Uint8Array;
  } = {},
) {
  return {
    kind: SubstructureKind.VALUE_FLOW_PORT,
    data: valueFlowPort({
      accountIndex: opts.accountIndex ?? 0,
      tokenValue: tokenValue(kind, {
        accountIndex: opts.tokenAccountIndex,
        value: opts.value,
      }),
    }),
  };
}

function matched(opts: {
  programId?: string;
  discriminator?: string;
  accounts: RequirementAccount[];
  data?: Uint8Array;
  typePool?: Uint8Array;
  rootType?: number;
  mintAssociations?: { accountIndex: number; mintIndex: number }[];
  substructures?: { kind: SubstructureKind; data: Uint8Array }[];
  enumCache?: VariantCache;
}): MatchedInstruction {
  return {
    instruction: {
      programId: opts.programId ?? "Prog",
      accounts: opts.accounts,
      data: opts.data ?? new Uint8Array(),
    },
    descriptor: {
      discriminator: opts.discriminator ?? "00",
      instructionInfo: instructionInfo({
        typePool: opts.typePool ?? bytes(0x00),
        rootType: opts.rootType ?? 0,
        mintAssociations: opts.mintAssociations,
      }),
      substructures: opts.substructures ?? [],
      enumCache: opts.enumCache ?? EMPTY_CACHE,
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
        substructures: [port(TokenKind.NATIVE, { accountIndex: 0 })],
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
        substructures: [
          port(TokenKind.DIRECT, {
            value: value(ValueSource.CONSTANT, mintBytes),
          }),
        ],
      }),
    ]);
    expect(result.tokenInfos).toEqual([DefaultBs58Encoder.encode(mintBytes)]);
  });

  it("DIRECT port: an ACCOUNT_PATH mint resolves to the account address", () => {
    const result = run([
      matched({
        accounts: [account("tokenAcct"), account("theMint")],
        substructures: [
          port(TokenKind.DIRECT, {
            value: value(ValueSource.ACCOUNT_PATH, bytes(1)),
          }),
        ],
      }),
    ]);
    expect(result.tokenInfos).toEqual(["theMint"]);
  });

  it("RESOLVE port not covered by MINT_ASSOC: sends TOKEN_ACCOUNT_STATE", () => {
    const result = run([
      matched({
        accounts: [account("userAta")],
        substructures: [
          port(TokenKind.RESOLVE, { accountIndex: 0, tokenAccountIndex: 0 }),
        ],
      }),
    ]);
    expect(result.tokenAccountStates).toEqual(["userAta"]);
    expect(result.tokenInfos).toEqual([]);
  });

  it("RESOLVE port covered by MINT_ASSOC: emits TOKEN_INFO, skips account-state", () => {
    const result = run([
      matched({
        accounts: [account("createdAta"), account("theMint")],
        mintAssociations: [{ accountIndex: 0, mintIndex: 1 }],
        substructures: [
          port(TokenKind.RESOLVE, { accountIndex: 0, tokenAccountIndex: 0 }),
        ],
      }),
    ]);
    expect(result.tokenAccountStates).toEqual([]);
    expect(result.tokenInfos).toEqual(["theMint"]);
  });

  it("NULL port pulls no token requirements", () => {
    const result = run([
      matched({
        accounts: [account("x")],
        substructures: [port(TokenKind.NULL)],
      }),
    ]);
    expect(result.tokenInfos).toEqual([]);
    expect(result.tokenAccountStates).toEqual([]);
  });

  it("ACCOUNT_RESET with requirePreBalanceZero forces a TOKEN_ACCOUNT_STATE", () => {
    const result = run([
      matched({
        accounts: [account("ata")],
        substructures: [
          {
            kind: SubstructureKind.ACCOUNT_RESET,
            data: accountReset({
              accountIndex: 0,
              requirePreBalanceZero: true,
            }),
          },
        ],
      }),
    ]);
    expect(result.tokenAccountStates).toEqual(["ata"]);
  });

  it("ACCOUNT_RESET without the flag adds nothing", () => {
    const result = run([
      matched({
        accounts: [account("ata")],
        substructures: [
          {
            kind: SubstructureKind.ACCOUNT_RESET,
            data: accountReset({ accountIndex: 0 }),
          },
        ],
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
        substructures: [
          {
            kind: SubstructureKind.DISPLAY_FIELD,
            data: trustedNameDisplayField(
              value(ValueSource.ACCOUNT_PATH, bytes(1)),
            ),
          },
          {
            kind: SubstructureKind.DISPLAY_FIELD,
            data: trustedNameDisplayField(
              value(ValueSource.CONSTANT, constantAddr),
            ),
          },
        ],
      }),
    ]);
    expect(result.trustedNames).toEqual([
      "namedAccount",
      DefaultBs58Encoder.encode(constantAddr),
    ]);
  });

  it("decodes selected enum variants via the default decoder", () => {
    // pool: [0] STRUCT{ref 1}, [1] ENUM disc=U8 enum_id="k"; data selects variant 2.
    const typePool = bytes(
      2,
      0x20,
      0x01,
      0x01,
      0x28,
      0x01,
      0x00,
      0x01,
      0x01,
      0x6b,
    );
    const result = buildRequirements([
      matched({
        programId: "P",
        accounts: [],
        data: bytes(2),
        typePool,
        rootType: 0,
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
        substructures: [
          port(TokenKind.DIRECT, { value: value(ValueSource.CONSTANT, usdc) }),
        ],
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
          substructures: [
            port(TokenKind.DIRECT, {
              accountIndex: 0,
              value: value(ValueSource.CONSTANT, inMint),
            }),
            port(TokenKind.DIRECT, {
              accountIndex: 1,
              value: value(ValueSource.CONSTANT, outMint),
            }),
          ],
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

  it("surfaces a malformed INSTRUCTION_INFO as a typed Left", () => {
    const broken: MatchedInstruction = {
      instruction: { programId: "P", accounts: [], data: new Uint8Array() },
      descriptor: {
        discriminator: "00",
        instructionInfo: bytes(0x07, 0x01, 0x00), // root type only, no type pool
        substructures: [],
        enumCache: EMPTY_CACHE,
      },
    };
    const result: Either<unknown, unknown> = buildRequirements([broken], {
      selectEnumVariants: NO_ENUMS,
    });
    expect(result.isLeft()).toBe(true);
    result.ifLeft((error) =>
      expect(error).toBeInstanceOf(MissingInstructionFieldError),
    );
  });
});
