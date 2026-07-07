/**
 * Builders for the decoded CAL JSON the requirement builder consumes.
 */

import { type CalTypePoolEntry } from "@internal/app-binder/clear-sign/idl-type-pool";
import {
  type CalAccountReset,
  type CalDisplayField,
  type CalIdlDescriptor,
  type CalMintAssociation,
  type CalTokenValue,
  type CalValue,
  type CalValueFlowPort,
} from "@internal/app-binder/clear-sign/requirements/calTypes";
import { type InstructionDescriptor } from "@internal/app-binder/clear-sign/requirements/model";

export function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- VALUE -----------------------------------------------------------------

export function constantValue(payload: Uint8Array): CalValue {
  return { source: "CONSTANT", data: toHex(payload) };
}

export function accountPathValue(accountIndex: number): CalValue {
  return { source: "ACCOUNT_PATH", account_index: accountIndex };
}

export function argumentPathValue(steps: number[] = []): CalValue {
  return { source: "ARGUMENT_PATH", path: { steps } };
}

// ---- substructures ---------------------------------------------------------

export function tokenValue(
  kind: CalTokenValue["kind"],
  opts: { value?: CalValue; accountIndex?: number } = {},
): CalTokenValue {
  return { kind, value: opts.value, account_index: opts.accountIndex };
}

export function valueFlowPort(opts: {
  accountIndex?: number;
  accountIndices?: number[];
  optionalAccountStrategy?: CalValueFlowPort["optional_account_strategy"];
  tokenValue?: CalTokenValue;
}): CalValueFlowPort {
  return {
    account_indices:
      opts.accountIndices ??
      (opts.accountIndex !== undefined ? [opts.accountIndex] : []),
    optional_account_strategy: opts.optionalAccountStrategy,
    token_value: opts.tokenValue,
  };
}

export function accountReset(opts: {
  accountIndex: number;
  requirePreBalanceZero?: boolean;
}): CalAccountReset {
  return {
    account_index: opts.accountIndex,
    require_pre_balance_zero: opts.requirePreBalanceZero,
  };
}

export function trustedNameDisplayField(value: CalValue): CalDisplayField {
  return { name: "Name", param: { type: "TRUSTED_NAME", value } };
}

export function tokenAmountDisplayField(token: CalValue): CalDisplayField {
  return {
    name: "Amount",
    param: { type: "TOKEN_AMOUNT", value: argumentPathValue([0]), token },
  };
}

// ---- descriptor ------------------------------------------------------------

export function idlDescriptor(opts: {
  typePool?: CalTypePoolEntry[];
  rootType?: number;
}): CalIdlDescriptor {
  return {
    type_pool: opts.typePool ?? [{ index: 0, kind: "STRUCT", refs: [] }],
    root_type: opts.rootType ?? 0,
  };
}

export function descriptor(
  overrides: Partial<InstructionDescriptor> = {},
): InstructionDescriptor {
  return {
    discriminator: "00",
    idlDescriptor: idlDescriptor({}),
    mintAssociations: [],
    valueFlowPorts: [],
    accountResets: [],
    displayFields: [],
    enumCache: new Map(),
    ...overrides,
  };
}

export function mintAssociation(
  accountIndex: number,
  mintIndex: number,
): CalMintAssociation {
  return { account_index: accountIndex, mint_index: mintIndex };
}
