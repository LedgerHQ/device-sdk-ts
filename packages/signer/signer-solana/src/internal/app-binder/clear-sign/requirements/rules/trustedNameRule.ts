import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_ACCOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  type ParsedInstruction,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import {
  altRefForPubkeyValue,
  resolvePubkeyValue,
} from "@internal/app-binder/clear-sign/requirements/valueResolution";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

/**
 * Each `PARAM_TRUSTED_NAME` or `PARAM_ACCOUNT` display field targets an address
 * that may have a CAL name. For `PARAM_ACCOUNT` this is best-effort: the device
 * shows the name if a descriptor is found and falls back to the base58 address
 * otherwise.
 *
 * A field targeting an ALT-supplied slot has no address yet at build time —
 * `resolvePubkeyValue` misses — so it is recorded as a `trustedNameAltRef`
 * instead: `altResolutionRule` already requests this slot's `ALT_RESOLUTION`,
 * and the provide phase fetches the TRUSTED_NAME once that resolution comes
 * back.
 */
export function applyTrustedNameRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
  bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
): void {
  for (const field of parsed.displayFields) {
    if (
      (field.paramType !== PARAM_TYPE_TRUSTED_NAME &&
        field.paramType !== PARAM_TYPE_ACCOUNT) ||
      field.value === undefined
    ) {
      continue;
    }
    const target = resolvePubkeyValue(field.value, instruction, bs58Encoder);
    if (target !== undefined) {
      accumulator.addTrustedName(target);
      continue;
    }
    const altRef = altRefForPubkeyValue(field.value, instruction);
    if (altRef !== undefined) {
      accumulator.addTrustedNameAltRef(altRef.altAddress, altRef.entryIndex);
    }
  }
}
