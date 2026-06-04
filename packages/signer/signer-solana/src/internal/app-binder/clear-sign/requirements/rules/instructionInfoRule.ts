import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

/** Every matched instruction needs its `(programId, discriminator)` descriptor. */
export function applyInstructionInfoRule(
  matched: MatchedInstruction,
  accumulator: RequirementAccumulator,
): void {
  accumulator.addInstructionInfo(
    matched.instruction.programId,
    matched.descriptor.discriminator,
  );
}
