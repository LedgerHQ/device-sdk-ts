import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { poolFromJson } from "@internal/app-binder/clear-sign/idl-type-pool";

import {
  type CalAccountReset,
  type CalDisplayField,
  type CalIdlDescriptor,
  type CalMintAssociation,
  type CalTokenValue,
  type CalValue,
  type CalValueFlowPort,
} from "./calTypes";
import {
  type MintAssociation,
  OptionalAccountStrategy,
  type ParsedAccountReset,
  type ParsedDisplayField,
  type ParsedInstructionInfo,
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
  };
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
): ParsedInstructionInfo {
  return {
    typePool: poolFromJson(idlDescriptor.type_pool),
    rootType: idlDescriptor.root_type,
    mintAssociations: mintAssociations.map<MintAssociation>((association) => ({
      accountIndex: association.account_index,
      mintIndex: association.mint_index,
    })),
  };
}
