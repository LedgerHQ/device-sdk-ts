import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_TRUSTED_NAME,
  type ParsedInstruction,
} from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { resolvePubkeyValue } from "@internal/app-binder/clear-sign/requirements/valueResolution";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

/** Each `PARAM_TRUSTED_NAME` display field targets an address needing a name. */
export function applyTrustedNameRule(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
  bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
): void {
  for (const field of parsed.displayFields) {
    if (
      field.paramType !== PARAM_TYPE_TRUSTED_NAME ||
      field.value === undefined
    ) {
      continue;
    }
    const target = resolvePubkeyValue(field.value, instruction, bs58Encoder);
    if (target !== undefined) accumulator.addTrustedName(target);
  }
}
