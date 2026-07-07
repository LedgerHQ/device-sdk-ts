import { type Either } from "purify-ts";

import {
  type Entry,
  type SelectedEnumVariant,
  type VariantCache,
} from "@internal/app-binder/clear-sign/idl-type-pool";
import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import {
  RequirementsDecodeError,
  type RequirementsError,
} from "@internal/app-binder/clear-sign/requirements/RequirementsError";

/**
 * Decodes the instruction data against the type pool to find the enum variants
 * it selects. Injected (defaults to the real type-pool decoder) so the rule
 * stays testable without a full decode.
 */
export type EnumVariantSelector = (
  typePool: Entry[],
  rootType: number,
  enumCache: VariantCache,
  data: Uint8Array,
) => Either<{ originalError: Error }, SelectedEnumVariant[]>;

/** One `ENUM_VARIANT` descriptor per `(programId, enumId, variantIndex)` selected. */
export function applyEnumVariantRule(
  matched: MatchedInstruction,
  accumulator: RequirementAccumulator,
  selectEnumVariants: EnumVariantSelector,
  parsedTypePool: Entry[],
  parsedRootType: number,
): Either<RequirementsError, void> {
  const { programId } = matched.instruction;
  return selectEnumVariants(
    parsedTypePool,
    parsedRootType,
    matched.descriptor.enumCache,
    matched.instruction.data,
  )
    .mapLeft<RequirementsError>(
      (error) => new RequirementsDecodeError(error.originalError.message),
    )
    .map((selected) => {
      for (const { enumId, variantIndex } of selected) {
        accumulator.addEnumVariant(programId, enumId, variantIndex);
      }
    });
}
