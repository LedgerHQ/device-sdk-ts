import { type Entry } from "@internal/app-binder/clear-sign/idl-type-pool";

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

/** `HIDE_RULE.CONDITION` (`HideCondition` enum). */
export enum HideCondition {
  CREATED_IN_TRANSACTION = 0x00,
  IS_SIGNER = 0x01,
  ACCOUNT_USED_ELSEWHERE = 0x02,
  IS_ANOTHER_SIGNER = 0x03,
  ACCOUNT_EFFECTS_DISPLAYED_ELSEWHERE = 0x04,
}

/** `VALUE_FLOW_PORT.ACTIVE_WHEN` predicate (`ActiveWhenPredicate` enum). */
export enum ActiveWhenPredicate {
  CREATED_IN_TRANSACTION = 0x00,
  IS_SIGNER = 0x01,
  ACCOUNT_USED_ELSEWHERE = 0x02,
  MINT_PREDICATE = 0x03,
  IS_ANOTHER_SIGNER = 0x04,
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

/**
 * `DISPLAY_FIELD.PARAM_TYPE` value for a raw account address (base58 short
 * form). We attempt a trusted-name lookup for these too, so the device can show
 * a CAL name (e.g. a token mint's name) instead of an opaque pubkey when one is
 * available; it falls back to base58 otherwise.
 */
export const PARAM_TYPE_ACCOUNT = 0x08;

/** `DISPLAY_FIELD.PARAM_TYPE` value for a token amount with a token reference. */
export const PARAM_TYPE_TOKEN_AMOUNT = 0x02;

export type ParsedValue = { source: ValueSource; payload: Uint8Array };

export type ParsedTokenValue = {
  kind: TokenKind;
  value?: ParsedValue;
  accountIndex?: number;
  /**
   * `RESOLVE` only (`TOKEN_VALUE.FALLBACK_ACCOUNT`): the account index whose
   * *address* the device uses as the mint once the binding lookup has failed
   * through both the mint-association map and `TOKEN_ACCOUNT_STATE`. The device
   * dereferences it unconditionally, so an ALT-backed slot here still needs an
   * `ALT_RESOLUTION` or finalize refuses the transaction.
   */
  fallbackAccountIndex?: number;
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
  /**
   * `ACTIVE_WHEN` predicates, ANDed. Only the predicate codes are carried:
   * `MINT_PREDICATE`'s trailing mint drives nothing host-side (the device
   * compares it against the resolved token itself).
   */
  activeWhen: ActiveWhenPredicate[];
};

/**
 * One `HIDE_RULE`. `target` is absent when the rule's target could not be
 * mapped to a `VALUE` (CAL omitted it), which makes the rule inert host-side.
 */
export type ParsedHideRule = {
  ruleSetIndex: number;
  condition?: HideCondition;
  target?: ParsedValue;
};

/** An `OWNER_ASSOC_ACCOUNT` / `OWNER_ASSOC_OWNER` pair. */
export type ParsedOwnerAssociation = {
  accountIndex: number;
  owner: ParsedValue;
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
  /** The IDL type pool, built from CAL's `type_pool` JSON (see `poolFromJson`). */
  typePool: Entry[];
  rootType: number;
  mintAssociations: MintAssociation[];
  ownerAssociations: ParsedOwnerAssociation[];
};

/** An instruction's INSTRUCTION_INFO + its substructures, grouped by kind. */
export type ParsedInstruction = {
  info: ParsedInstructionInfo;
  valueFlowPorts: ParsedValueFlowPort[];
  accountResets: ParsedAccountReset[];
  displayFields: ParsedDisplayField[];
  hideRules: ParsedHideRule[];
};
