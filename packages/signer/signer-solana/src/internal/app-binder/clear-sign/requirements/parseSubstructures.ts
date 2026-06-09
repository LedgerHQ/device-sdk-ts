import {
  firstTag,
  firstU8,
  readTlvEntries,
  type TlvEntry,
} from "./descriptorTlv";
import {
  type MintAssociation,
  OptionalAccountStrategy,
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedAccountReset,
  type ParsedDisplayField,
  type ParsedInstructionInfo,
  type ParsedTokenValue,
  type ParsedValue,
  type ParsedValueFlowPort,
  type TokenKind,
  type ValueSource,
} from "./records";
import { fail, MissingInstructionFieldError } from "./RequirementsError";

const InstructionInfoTag = {
  IDL_TYPE_POOL: 0x06,
  IDL_ROOT_TYPE: 0x07,
  MINT_ASSOC_ACCOUNT: 0x08,
  MINT_ASSOC_MINT: 0x09,
} as const;

const ValueFlowPortTag = {
  // ACCOUNT_INDEX MAY repeat to form an ordered candidate list.
  ACCOUNT_INDEX: 0x02,
  TOKEN_VALUE: 0x05,
  OPTIONAL_ACCOUNT_STRATEGY: 0x07,
} as const;

const TokenValueTag = {
  KIND: 0x01,
  VALUE: 0x02,
  ACCOUNT: 0x03,
} as const;

const ValueTag = {
  SOURCE: 0x01,
  PAYLOAD: 0x02,
} as const;

const DisplayFieldTag = {
  PARAM_TYPE: 0x02,
  PARAM: 0x03,
} as const;

// The VALUE tag is `0x01` inside every PARAM_* substructure.
const PARAM_VALUE_TAG = 0x01;

// `PARAM_TOKEN_AMOUNT.TOKEN` (the token reference) lives at tag `0x02`.
const PARAM_TOKEN_AMOUNT_TOKEN_TAG = 0x02;

/** Collect the leading byte of every entry carrying `tag` (for repeated tags). */
function allU8(entries: TlvEntry[], tag: number): number[] {
  const out: number[] = [];
  for (const entry of entries) {
    if (entry.tag === tag && entry.value.length > 0) out.push(entry.value[0]!);
  }
  return out;
}

const AccountResetTag = {
  ACCOUNT_INDEX: 0x01,
  REQUIRE_PRE_BALANCE_ZERO: 0x02,
} as const;

function parseValue(bytes: Uint8Array): ParsedValue {
  const entries = readTlvEntries(bytes);
  return {
    source: (firstU8(entries, ValueTag.SOURCE) ?? 0) as ValueSource,
    payload: firstTag(entries, ValueTag.PAYLOAD) ?? new Uint8Array(),
  };
}

function parseTokenValue(bytes: Uint8Array): ParsedTokenValue {
  const entries = readTlvEntries(bytes);
  const valueBytes = firstTag(entries, TokenValueTag.VALUE);
  return {
    kind: (firstU8(entries, TokenValueTag.KIND) ?? 0) as TokenKind,
    value: valueBytes ? parseValue(valueBytes) : undefined,
    accountIndex: firstU8(entries, TokenValueTag.ACCOUNT),
  };
}

/**
 * Parse an INSTRUCTION_INFO TLV into the fields the requirement builder needs.
 * `IDL_TYPE_POOL` and `IDL_ROOT_TYPE` are mandatory; `MINT_ASSOC_*` pairs are
 * collected in order (an account tag immediately followed by its mint tag).
 */
export function parseInstructionInfo(bytes: Uint8Array): ParsedInstructionInfo {
  const entries = readTlvEntries(bytes);
  const typePool = firstTag(entries, InstructionInfoTag.IDL_TYPE_POOL);
  if (typePool === undefined) {
    fail(new MissingInstructionFieldError("IDL_TYPE_POOL"));
  }
  const rootType = firstU8(entries, InstructionInfoTag.IDL_ROOT_TYPE);
  if (rootType === undefined) {
    fail(new MissingInstructionFieldError("IDL_ROOT_TYPE"));
  }

  const mintAssociations: MintAssociation[] = [];
  let pendingAccountIndex: number | undefined;
  for (const { tag, value } of entries) {
    if (tag === InstructionInfoTag.MINT_ASSOC_ACCOUNT && value.length > 0) {
      pendingAccountIndex = value[0];
    } else if (
      tag === InstructionInfoTag.MINT_ASSOC_MINT &&
      value.length > 0 &&
      pendingAccountIndex !== undefined
    ) {
      mintAssociations.push({
        accountIndex: pendingAccountIndex,
        mintIndex: value[0]!,
      });
      pendingAccountIndex = undefined;
    }
  }

  return { typePool, rootType, mintAssociations };
}

export function parseValueFlowPort(bytes: Uint8Array): ParsedValueFlowPort {
  const entries = readTlvEntries(bytes);
  const tokenValueBytes = firstTag(entries, ValueFlowPortTag.TOKEN_VALUE);
  return {
    accountIndices: allU8(entries, ValueFlowPortTag.ACCOUNT_INDEX),
    optionalAccountStrategy: (firstU8(
      entries,
      ValueFlowPortTag.OPTIONAL_ACCOUNT_STRATEGY,
    ) ?? OptionalAccountStrategy.PROGRAM_ID) as OptionalAccountStrategy,
    tokenValue: tokenValueBytes ? parseTokenValue(tokenValueBytes) : undefined,
  };
}

export function parseAccountReset(bytes: Uint8Array): ParsedAccountReset {
  const entries = readTlvEntries(bytes);
  return {
    accountIndex: firstU8(entries, AccountResetTag.ACCOUNT_INDEX) ?? 0,
    requirePreBalanceZero:
      (firstU8(entries, AccountResetTag.REQUIRE_PRE_BALANCE_ZERO) ?? 0) !== 0,
  };
}

export function parseDisplayField(bytes: Uint8Array): ParsedDisplayField {
  const entries = readTlvEntries(bytes);
  const paramType = firstU8(entries, DisplayFieldTag.PARAM_TYPE);
  const paramBytes = firstTag(entries, DisplayFieldTag.PARAM);
  const paramEntries = paramBytes ? readTlvEntries(paramBytes) : [];
  const valueBytes = firstTag(paramEntries, PARAM_VALUE_TAG);
  // The TOKEN reference only exists (and tag 0x02 only means TOKEN) for a
  // PARAM_TOKEN_AMOUNT param; for other param types tag 0x02 carries unrelated
  // fields (e.g. decimals), so guard on the param type.
  const tokenBytes =
    paramType === PARAM_TYPE_TOKEN_AMOUNT
      ? firstTag(paramEntries, PARAM_TOKEN_AMOUNT_TOKEN_TAG)
      : undefined;
  return {
    paramType,
    value: valueBytes ? parseValue(valueBytes) : undefined,
    token: tokenBytes ? parseValue(tokenBytes) : undefined,
  };
}
