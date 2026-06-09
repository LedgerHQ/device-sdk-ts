import { type Either, Left, Right } from "purify-ts";

import { findSelectedEnumVariants } from "@internal/app-binder/clear-sign/idl-type-pool";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

import { type DescriptorRequirements, type MatchedInstruction } from "./model";
import { parseInstructionDescriptor } from "./parseInstruction";
import { type ParsedInstruction } from "./records";
import { RequirementAccumulator } from "./RequirementAccumulator";
import {
  RequirementsDecodeError,
  type RequirementsError,
  RequirementsThrow,
} from "./RequirementsError";
import {
  applyAltResolutionRule,
  applyEnumVariantRule,
  applyInstructionInfoRule,
  applyTokenRule,
  applyTrustedNameRule,
  type EnumVariantSelector,
} from "./rules";

export type BuildRequirementsOptions = {
  /** Enum-variant decoder; defaults to the real type-pool decoder. */
  selectEnumVariants?: EnumVariantSelector;
  /** Base58 encoder for pubkey constants; defaults to {@link DefaultBs58Encoder}. */
  bs58Encoder?: Bs58Encoder;
};

/** TX-derived `MINT_ASSOC` bindings: token-account address → mint address. */
function buildMintBindings(
  matched: MatchedInstruction[],
  parsed: ParsedInstruction[],
): Map<string, string> {
  const bindings = new Map<string, string>();
  matched.forEach((match, index) => {
    const { accounts } = match.instruction;
    for (const { accountIndex, mintIndex } of parsed[index]!.info
      .mintAssociations) {
      const account = accounts[accountIndex]?.address;
      const mint = accounts[mintIndex]?.address;
      if (account !== undefined && mint !== undefined) {
        bindings.set(account, mint);
      }
    }
  });
  return bindings;
}

/**
 * Given every TX instruction matched to its CAL descriptor, compute the
 * deduplicated set of extra descriptors the device must fetch. Pure and
 * deterministic; malformed descriptors surface as a typed
 * {@link RequirementsError} `Left`.
 */
export function buildRequirements(
  matched: MatchedInstruction[],
  options: BuildRequirementsOptions = {},
): Either<RequirementsError, DescriptorRequirements> {
  const selectEnumVariants =
    options.selectEnumVariants ?? findSelectedEnumVariants;
  const bs58Encoder = options.bs58Encoder ?? DefaultBs58Encoder;
  try {
    const accumulator = new RequirementAccumulator();
    const instructions = matched.map((match) => ({
      match,
      records: parseInstructionDescriptor(match.descriptor),
    }));
    const mintBindings = buildMintBindings(
      matched,
      instructions.map(({ records }) => records),
    );

    for (const { match, records } of instructions) {
      applyInstructionInfoRule(match, accumulator);

      const decodeFailure = applyEnumVariantRule(
        match,
        accumulator,
        selectEnumVariants,
        records.info.typePool,
        records.info.rootType,
      ).extract();
      if (decodeFailure) return Left(decodeFailure);

      applyTokenRule(
        records,
        match.instruction,
        mintBindings,
        accumulator,
        bs58Encoder,
      );
      applyAltResolutionRule(match.instruction, accumulator);
      applyTrustedNameRule(
        records,
        match.instruction,
        accumulator,
        bs58Encoder,
      );
    }

    return Right(accumulator.build());
  } catch (error) {
    if (error instanceof RequirementsThrow) {
      return Left(error.error);
    }
    return Left(
      new RequirementsDecodeError(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}
