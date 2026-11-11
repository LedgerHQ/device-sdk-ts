import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

/**
 * Every matched instruction needs its `(programId, discriminator)` descriptor.
 *
 * @deprecated Unused; will be removed in the next major version. Instruction-info
 * requirements are no longer collected, so this does nothing.
 */
export function applyInstructionInfoRule(
  matched: MatchedInstruction,
  accumulator: RequirementAccumulator,
): void {
  accumulator.addInstructionInfo(
    matched.instruction.programId,
    matched.descriptor.discriminator,
  );
}
