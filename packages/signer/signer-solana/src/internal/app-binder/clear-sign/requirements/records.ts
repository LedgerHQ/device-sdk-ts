/** Where a VALUE is sourced from (`VALUE.SOURCE`). */
export enum ValueSource {
  ARGUMENT_PATH = 0x00,
  ACCOUNT_PATH = 0x01,
  CONSTANT = 0x02,
}

/** How a port's token identity is resolved (`TOKEN_VALUE.KIND`). */
export enum TokenKind {
  DIRECT = 0x00,
  RESOLVE = 0x01,
  NULL = 0x02,
  NATIVE = 0x03,
}

/**
 * How a candidate-array port's optional (non-final) candidates are detected as
 * *unset* (`VALUE_FLOW_PORT.OPTIONAL_ACCOUNT_STRATEGY`). Only meaningful when a
 * port carries more than one candidate index; defaults to `PROGRAM_ID`.
 */
export enum OptionalAccountStrategy {
  /** Slot is unset when its address equals the instruction's program id. */
  PROGRAM_ID = 0x00,
  /** Slot is unset only when out of range (an omitted trailing account). */
  OMITTED = 0x01,
}

/** `DISPLAY_FIELD.PARAM_TYPE` value for an address resolved via trusted name. */
export const PARAM_TYPE_TRUSTED_NAME = 0x07;

/** `DISPLAY_FIELD.PARAM_TYPE` value for a token amount with a token reference. */
export const PARAM_TYPE_TOKEN_AMOUNT = 0x02;

export type ParsedValue = { source: ValueSource; payload: Uint8Array };

export type ParsedTokenValue = {
  kind: TokenKind;
  value?: ParsedValue;
  accountIndex?: number;
};

export type ParsedValueFlowPort = {
  /**
   * Ordered candidate account indices (length 1 for the common single-account
   * port). Resolved to the first *provided* candidate; see
   * `resolvePortAccountIndex`.
   */
  accountIndices: number[];
  optionalAccountStrategy: OptionalAccountStrategy;
  tokenValue?: ParsedTokenValue;
};

export type ParsedAccountReset = {
  accountIndex: number;
  requirePreBalanceZero: boolean;
};

export type ParsedDisplayField = {
  paramType?: number;
  value?: ParsedValue;
  /**
   * The `PARAM_TOKEN_AMOUNT.TOKEN` reference, populated only for a
   * `PARAM_TYPE_TOKEN_AMOUNT` field. Identifies the token whose `TOKEN_INFO`
   * the amount formatter needs; may point at a mint or, via a TX-derived
   * `MINT_ASSOC` binding, at a token account.
   */
  token?: ParsedValue;
};

export type MintAssociation = { accountIndex: number; mintIndex: number };

export type ParsedInstructionInfo = {
  typePool: Uint8Array;
  rootType: number;
  mintAssociations: MintAssociation[];
};

/** An instruction's INSTRUCTION_INFO + its substructures, grouped by kind. */
export type ParsedInstruction = {
  info: ParsedInstructionInfo;
  valueFlowPorts: ParsedValueFlowPort[];
  accountResets: ParsedAccountReset[];
  displayFields: ParsedDisplayField[];
};
