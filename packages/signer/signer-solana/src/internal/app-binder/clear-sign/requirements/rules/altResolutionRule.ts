import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

/**
 * Every ALT-supplied account an instruction references needs an `ALT_RESOLUTION`.
 * ALT entries the instruction never references are absent from its account list
 * and so are skipped.
 */
export function applyAltResolutionRule(
  instruction: RequirementInstruction,
  accumulator: RequirementAccumulator,
): void {
  for (const account of instruction.accounts) {
    if (account.altRef !== undefined) {
      accumulator.addAltResolution(
        account.altRef.altAddress,
        account.altRef.entryIndex,
      );
    }
  }
}
