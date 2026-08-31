import { type Bs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { type AltEntryKey, type RequirementInstruction } from "./model";
import {
  OptionalAccountStrategy,
  type ParsedValue,
  type ParsedValueFlowPort,
  ValueSource,
} from "./records";

const PUBKEY_LENGTH = 32;

/** The resolved address of an account slot, bounds-checked. */
export function accountAddressAt(
  instruction: RequirementInstruction,
  index: number,
): string | undefined {
  if (index < 0 || index >= instruction.accounts.length) return undefined;
  return instruction.accounts[index]!.address;
}

/**
 * The ALT reference of an account slot, bounds-checked. Set only for slots the
 * host cannot resolve (ALT-supplied, no `ALT_RESOLUTION` streamed yet), so it is
 * the natural complement of {@link accountAddressAt}: exactly one of the two
 * answers for any slot of a parsed message.
 */
export function accountAltRefAt(
  instruction: RequirementInstruction,
  index: number,
): AltEntryKey | undefined {
  if (index < 0 || index >= instruction.accounts.length) return undefined;
  return instruction.accounts[index]!.altRef;
}

/**
 * Resolve a value-flow port to a single account index. A single-candidate port
 * returns that candidate. An ordered candidate list (optional accounts with
 * fallbacks) returns the first *provided* candidate: a non-final candidate is
 * *unset* when its slot is out of range, or — under the `PROGRAM_ID` strategy —
 * when the slot holds the program id. The final candidate is non-optional and
 * always resolves. Returns `-1` for an empty candidate list.
 */
export function resolvePortAccountIndex(
  port: ParsedValueFlowPort,
  instruction: RequirementInstruction,
): number {
  const indices = port.accountIndices;
  if (indices.length === 0) return -1;
  for (const idx of indices.slice(0, -1)) {
    if (idx < 0 || idx >= instruction.accounts.length) continue;
    if (
      port.optionalAccountStrategy !== OptionalAccountStrategy.OMITTED &&
      instruction.accounts[idx]!.address === instruction.programId
    ) {
      continue;
    }
    return idx;
  }
  return indices[indices.length - 1]!;
}

/**
 * The ALT reference behind a pubkey-bearing VALUE — the complement of
 * {@link resolvePubkeyValue} for an `ACCOUNT_PATH` into an unresolved slot.
 * A `CONSTANT` is already an address and an `ARGUMENT_PATH` names no slot, so
 * both yield `undefined`.
 */
export function altRefForPubkeyValue(
  value: ParsedValue,
  instruction: RequirementInstruction,
): AltEntryKey | undefined {
  if (value.source !== ValueSource.ACCOUNT_PATH) return undefined;
  if (value.payload.length === 0) return undefined;
  return accountAltRefAt(instruction, value.payload[0]!);
}

/**
 * Resolve a pubkey-bearing VALUE to a base58 address: a 32-byte CONSTANT, or an
 * ACCOUNT_PATH into the instruction's accounts. ARGUMENT_PATH and unresolved
 * accounts yield `undefined`.
 */
export function resolvePubkeyValue(
  value: ParsedValue,
  instruction: RequirementInstruction,
  bs58Encoder: Bs58Encoder,
): string | undefined {
  switch (value.source) {
    case ValueSource.CONSTANT:
      return value.payload.length === PUBKEY_LENGTH
        ? bs58Encoder.encode(value.payload)
        : undefined;
    case ValueSource.ACCOUNT_PATH:
      return value.payload.length > 0
        ? accountAddressAt(instruction, value.payload[0]!)
        : undefined;
    default:
      return undefined;
  }
}
