import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { poolFromJson } from "@internal/app-binder/clear-sign/idl-type-pool";

import {
  type CalAccountReset,
  type CalActiveWhenPredicate,
  type CalDisplayField,
  type CalHideRule,
  type CalIdlDescriptor,
  type CalMintAssociation,
  type CalOwnerAssociation,
  type CalTokenValue,
  type CalValue,
  type CalValueFlowPort,
} from "./calTypes";
import {
  type ActiveWhenPredicate,
  type HideCondition,
  type MintAssociation,
  OptionalAccountStrategy,
  type ParsedAccountReset,
  type ParsedDisplayField,
  type ParsedHideRule,
  type ParsedInstructionInfo,
  type ParsedOwnerAssociation,
  type ParsedTokenValue,
  type ParsedValue,
  type ParsedValueFlowPort,
  type TokenKind,
  type ValueSource,
} from "./records";

const VALUE_SOURCE_BY_NAME: Readonly<Record<string, ValueSource>> = {
  ARGUMENT_PATH: 0x00,
  ACCOUNT_PATH: 0x01,
  CONSTANT: 0x02,
};

const TOKEN_KIND_BY_NAME: Readonly<Record<string, TokenKind>> = {
  DIRECT: 0x00,
  RESOLVE: 0x01,
  NULL: 0x02,
  NATIVE: 0x03,
};

const HIDE_CONDITION_BY_NAME: Readonly<Record<string, HideCondition>> = {
  CREATED_IN_TRANSACTION: 0x00,
  IS_SIGNER: 0x01,
  ACCOUNT_USED_ELSEWHERE: 0x02,
  IS_ANOTHER_SIGNER: 0x03,
  ACCOUNT_EFFECTS_DISPLAYED_ELSEWHERE: 0x04,
};

const ACTIVE_WHEN_BY_NAME: Readonly<Record<string, ActiveWhenPredicate>> = {
  CREATED_IN_TRANSACTION: 0x00,
  IS_SIGNER: 0x01,
  ACCOUNT_USED_ELSEWHERE: 0x02,
  MINT_PREDICATE: 0x03,
  IS_ANOTHER_SIGNER: 0x04,
};

/**
 * Reject malformed/unknown CAL data. Thrown inside `buildRequirements`'s
 * try/catch, so it surfaces as a `RequirementsDecodeError` `Left` (the caller
 * then falls back to blind signing) rather than silently building wrong
 * requirements.
 */
function decodeError(message: string): never {
  throw new Error(`[ClearSign] malformed CAL descriptor: ${message}`);
}

/** `FieldParamType` name → on-wire code (mirrors the spec enum). */
const PARAM_TYPE_BY_NAME: Readonly<Record<string, number>> = {
  RAW: 0x00,
  AMOUNT: 0x01,
  TOKEN_AMOUNT: 0x02,
  DATETIME: 0x03,
  DURATION: 0x04,
  UNIT: 0x05,
  ENUM: 0x06,
  TRUSTED_NAME: 0x07,
  ACCOUNT: 0x08,
  STRING: 0x09,
};

/**
 * Map a CAL `VALUE` to the {@link ParsedValue} the resolver reads. `payload` is
 * reconstructed to the minimal bytes `resolvePubkeyValue` interprets: the raw
 * pubkey for CONSTANT, a single account-index byte for ACCOUNT_PATH. ARGUMENT_PATH
 * carries no pubkey, so its payload is empty (the resolver ignores it).
 */
export function fromCalValue(value: CalValue): ParsedValue {
  const source = VALUE_SOURCE_BY_NAME[value.source];
  if (source === undefined) {
    decodeError(`unknown VALUE source "${value.source}"`);
  }
  let payload: Uint8Array = new Uint8Array();
  if (value.source === "CONSTANT") {
    const bytes =
      value.data !== undefined ? hexaStringToBuffer(value.data) : null;
    if (bytes === null) {
      decodeError(`invalid CONSTANT hex "${value.data ?? ""}"`);
    }
    payload = bytes;
  } else if (
    value.source === "ACCOUNT_PATH" &&
    value.account_index !== undefined
  ) {
    payload = Uint8Array.from([value.account_index]);
  }
  return { source, payload };
}

export function fromCalTokenValue(tokenValue: CalTokenValue): ParsedTokenValue {
  const kind = TOKEN_KIND_BY_NAME[tokenValue.kind];
  if (kind === undefined) {
    decodeError(`unknown token_value kind "${tokenValue.kind}"`);
  }
  return {
    kind,
    value: tokenValue.value ? fromCalValue(tokenValue.value) : undefined,
    accountIndex: tokenValue.account_index,
    fallbackAccountIndex: tokenValue.fallback_account,
  };
}

/**
 * `VALUE_FLOW_PORT.ACTIVE_WHEN`: a bare `ActiveWhenPredicate` name, or an object
 * whose `kind` names it (`MINT_PREDICATE` carries the mint the device compares
 * against itself, so only the code is kept).
 *
 * An unrecognized predicate is dropped rather than rejected. Nothing host-side
 * evaluates activation — the only requirement keyed off this list is the
 * `IS_SIGNER` owner attestation, and an unknown name is by definition not
 * `IS_SIGNER` — so dropping it cannot under-request a descriptor, while
 * rejecting would fail the whole requirement build and degrade every
 * transaction touching the program to blind signing.
 */
function fromCalActiveWhen(
  predicates: CalActiveWhenPredicate[] | undefined,
): ActiveWhenPredicate[] {
  return (predicates ?? []).flatMap((predicate) => {
    const name = typeof predicate === "string" ? predicate : predicate.kind;
    const code = ACTIVE_WHEN_BY_NAME[name];
    return code === undefined ? [] : [code];
  });
}

/**
 * `VALUE_FLOW_PORT.OPTIONAL_ACCOUNT_STRATEGY`: absent defaults to `PROGRAM_ID`
 * (spec); any unrecognized value is rejected rather than silently treated as
 * `PROGRAM_ID`.
 */
function fromCalOptionalAccountStrategy(
  name: string | undefined,
): OptionalAccountStrategy {
  switch (name) {
    case undefined:
    case "PROGRAM_ID":
      return OptionalAccountStrategy.PROGRAM_ID;
    case "OMITTED":
      return OptionalAccountStrategy.OMITTED;
    default:
      return decodeError(`unknown optional_account_strategy "${name}"`);
  }
}

export function fromCalValueFlowPort(
  port: CalValueFlowPort,
): ParsedValueFlowPort {
  return {
    // CAL always emits the ordered candidate list `account_indices` (length 1
    // for the common single-account port).
    accountIndices: port.account_indices,
    optionalAccountStrategy: fromCalOptionalAccountStrategy(
      port.optional_account_strategy,
    ),
    tokenValue: fromCalTokenValue(port.token_value),
    activeWhen: fromCalActiveWhen(port.active_when),
  };
}

/**
 * One `HIDE_RULE`. An absent or unrecognized condition leaves `condition`
 * undefined instead of failing the decode: the rule's `target` is resolved by
 * the device for *every* rule it receives, so the entry must survive to keep
 * that target's `ALT_RESOLUTION` in the requirement set. Only the `IS_SIGNER`
 * owner attestation keys off the condition, and an unknown name is not
 * `IS_SIGNER`. `RULE_SET_INDEX` defaults to 0 (a single AND-set), matching the
 * spec's OR-of-ANDs default.
 */
export function fromCalHideRule(rule: CalHideRule): ParsedHideRule {
  return {
    ruleSetIndex: rule.rule_set_index ?? 0,
    condition:
      rule.condition === undefined
        ? undefined
        : HIDE_CONDITION_BY_NAME[rule.condition],
    target: rule.target ? fromCalValue(rule.target) : undefined,
  };
}

export function fromCalOwnerAssociation(
  association: CalOwnerAssociation,
): ParsedOwnerAssociation {
  return {
    accountIndex: association.account_index,
    owner: fromCalValue(association.owner),
  };
}

export function fromCalAccountReset(
  reset: CalAccountReset,
): ParsedAccountReset {
  return {
    accountIndex: reset.account_index,
    requirePreBalanceZero: reset.require_pre_balance_zero ?? false,
  };
}

export function fromCalDisplayField(
  field: CalDisplayField,
): ParsedDisplayField {
  return {
    paramType: PARAM_TYPE_BY_NAME[field.param.type],
    value: field.param.value ? fromCalValue(field.param.value) : undefined,
    token: field.param.token ? fromCalValue(field.param.token) : undefined,
  };
}

export function fromCalInstructionInfo(
  idlDescriptor: CalIdlDescriptor,
  mintAssociations: CalMintAssociation[],
  ownerAssociations: CalOwnerAssociation[],
): ParsedInstructionInfo {
  return {
    typePool: poolFromJson(idlDescriptor.type_pool),
    rootType: idlDescriptor.root_type,
    mintAssociations: mintAssociations.map<MintAssociation>((association) => ({
      accountIndex: association.account_index,
      mintIndex: association.mint_index,
    })),
    ownerAssociations: ownerAssociations.map(fromCalOwnerAssociation),
  };
}
