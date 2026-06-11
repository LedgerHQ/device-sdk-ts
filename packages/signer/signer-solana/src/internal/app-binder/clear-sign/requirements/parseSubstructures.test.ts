import {
  accountReset,
  bytes,
  instructionInfo,
  tokenAmountDisplayField,
  tokenValue,
  trustedNameDisplayField,
  value,
  valueFlowPort,
} from "./__tests__/fixtures/tlvBuilders";
import {
  parseAccountReset,
  parseDisplayField,
  parseInstructionInfo,
  parseValueFlowPort,
} from "./parseSubstructures";
import {
  PARAM_TYPE_TOKEN_AMOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  TokenKind,
  ValueSource,
} from "./records";
import {
  MissingInstructionFieldError,
  type RequirementsThrow,
} from "./RequirementsError";

describe("parseInstructionInfo", () => {
  it("extracts type pool, root type and MINT_ASSOC pairs", () => {
    const parsed = parseInstructionInfo(
      instructionInfo({
        typePool: bytes(0x01, 0x11),
        rootType: 3,
        mintAssociations: [{ accountIndex: 1, mintIndex: 4 }],
      }),
    );
    expect(Array.from(parsed.typePool)).toEqual([0x01, 0x11]);
    expect(parsed.rootType).toBe(3);
    expect(parsed.mintAssociations).toEqual([
      { accountIndex: 1, mintIndex: 4 },
    ]);
  });

  it("fails when IDL_TYPE_POOL is missing", () => {
    let caught: unknown;
    try {
      parseInstructionInfo(bytes(0x07, 0x01, 0x00)); // only root type
    } catch (error) {
      caught = error;
    }
    expect((caught as RequirementsThrow).error).toBeInstanceOf(
      MissingInstructionFieldError,
    );
  });
});

describe("parseValueFlowPort", () => {
  it("parses a RESOLVE port with an explicit token account index", () => {
    const parsed = parseValueFlowPort(
      valueFlowPort({
        accountIndex: 2,
        tokenValue: tokenValue(TokenKind.RESOLVE, { accountIndex: 5 }),
      }),
    );
    expect(parsed.accountIndices).toEqual([2]);
    expect(parsed.tokenValue).toMatchObject({
      kind: TokenKind.RESOLVE,
      accountIndex: 5,
    });
  });

  it("collects a repeated ACCOUNT_INDEX into an ordered candidate list and reads the strategy", () => {
    const parsed = parseValueFlowPort(
      valueFlowPort({
        accountIndices: [3, 7, 1],
        optionalAccountStrategy: 0x01,
      }),
    );
    expect(parsed.accountIndices).toEqual([3, 7, 1]);
    expect(parsed.optionalAccountStrategy).toBe(0x01);
  });

  it("defaults a single-account port to the PROGRAM_ID strategy", () => {
    const parsed = parseValueFlowPort(valueFlowPort({ accountIndex: 2 }));
    expect(parsed.accountIndices).toEqual([2]);
    expect(parsed.optionalAccountStrategy).toBe(0x00);
  });

  it("parses a DIRECT port with a constant mint", () => {
    const mint = new Uint8Array(32).fill(7);
    const parsed = parseValueFlowPort(
      valueFlowPort({
        accountIndex: 0,
        tokenValue: tokenValue(TokenKind.DIRECT, {
          value: value(ValueSource.CONSTANT, mint),
        }),
      }),
    );
    expect(parsed.tokenValue?.kind).toBe(TokenKind.DIRECT);
    expect(parsed.tokenValue?.value).toMatchObject({
      source: ValueSource.CONSTANT,
    });
    expect(parsed.tokenValue?.value?.payload).toHaveLength(32);
  });

  it("parses a NATIVE port with no value", () => {
    const parsed = parseValueFlowPort(
      valueFlowPort({
        accountIndex: 1,
        tokenValue: tokenValue(TokenKind.NATIVE),
      }),
    );
    expect(parsed.tokenValue).toMatchObject({ kind: TokenKind.NATIVE });
    expect(parsed.tokenValue?.value).toBeUndefined();
  });
});

describe("parseAccountReset", () => {
  it("reads the account index and the pre-balance-zero flag", () => {
    expect(
      parseAccountReset(
        accountReset({ accountIndex: 4, requirePreBalanceZero: true }),
      ),
    ).toEqual({ accountIndex: 4, requirePreBalanceZero: true });
    expect(parseAccountReset(accountReset({ accountIndex: 1 }))).toEqual({
      accountIndex: 1,
      requirePreBalanceZero: false,
    });
  });
});

describe("parseDisplayField", () => {
  it("parses a trusted-name field's inner VALUE", () => {
    const parsed = parseDisplayField(
      trustedNameDisplayField(value(ValueSource.ACCOUNT_PATH, bytes(6))),
    );
    expect(parsed.paramType).toBe(PARAM_TYPE_TRUSTED_NAME);
    expect(parsed.value).toMatchObject({ source: ValueSource.ACCOUNT_PATH });
    expect(Array.from(parsed.value!.payload)).toEqual([6]);
    expect(parsed.token).toBeUndefined();
  });

  it("parses a token-amount field's TOKEN reference (PARAM tag 0x02)", () => {
    const parsed = parseDisplayField(
      tokenAmountDisplayField(value(ValueSource.ACCOUNT_PATH, bytes(4))),
    );
    expect(parsed.paramType).toBe(PARAM_TYPE_TOKEN_AMOUNT);
    expect(parsed.token).toMatchObject({ source: ValueSource.ACCOUNT_PATH });
    expect(Array.from(parsed.token!.payload)).toEqual([4]);
  });
});
