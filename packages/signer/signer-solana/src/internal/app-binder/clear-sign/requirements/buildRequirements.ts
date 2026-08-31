import { type Either, Left, Right } from "purify-ts";

import { findSelectedEnumVariants } from "@internal/app-binder/clear-sign/idl-type-pool";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

import {
  type DescriptorRequirements,
  type MatchedInstruction,
  type TxBindings,
} from "./model";
import { parseInstructionDescriptor } from "./parseInstruction";
import { type ParsedInstruction } from "./records";
import { RequirementAccumulator } from "./RequirementAccumulator";
import {
  RequirementsDecodeError,
  type RequirementsError,
} from "./RequirementsError";
import {
  applyAltResolutionRule,
  applyEnumVariantRule,
  applyInstructionInfoRule,
  applyTokenRule,
  applyTrustedNameRule,
  type EnumVariantSelector,
} from "./rules";
import { resolvePubkeyValue } from "./valueResolution";

export type BuildRequirementsOptions = {
  /** Enum-variant decoder; defaults to the real type-pool decoder. */
  selectEnumVariants?: EnumVariantSelector;
  /** Base58 encoder for pubkey constants; defaults to {@link DefaultBs58Encoder}. */
  bs58Encoder?: Bs58Encoder;
};

/**
 * The TX-derived binding maps, both scoped to the whole transaction: token
 * account to mint (`MINT_ASSOC`) and token account to owner (`OWNER_ASSOC`).
 * Slots that stay unresolved host-side (ALT-backed, or out of range) contribute
 * no binding — the device then falls back to the attested descriptors, which is
 * exactly what the rules request for an uncovered account.
 */
function buildTxBindings(
  matched: MatchedInstruction[],
  parsed: ParsedInstruction[],
  bs58Encoder: Bs58Encoder,
): TxBindings {
  const mints = new Map<string, string>();
  const owners = new Map<string, string>();
  matched.forEach((match, index) => {
    const { accounts } = match.instruction;
    const { mintAssociations, ownerAssociations } = parsed[index]!.info;
    for (const { accountIndex, mintIndex } of mintAssociations) {
      const account = accounts[accountIndex]?.address;
      const mint = accounts[mintIndex]?.address;
      if (account !== undefined && mint !== undefined) {
        mints.set(account, mint);
      }
    }
    for (const { accountIndex, owner } of ownerAssociations) {
      const account = accounts[accountIndex]?.address;
      const ownerAddress = resolvePubkeyValue(
        owner,
        match.instruction,
        bs58Encoder,
      );
      if (account !== undefined && ownerAddress !== undefined) {
        owners.set(account, ownerAddress);
      }
    }
  });
  return { mints, owners };
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
    const bindings = buildTxBindings(
      matched,
      instructions.map(({ records }) => records),
      bs58Encoder,
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
        bindings,
        accumulator,
        bs58Encoder,
      );
      applyAltResolutionRule(records, match.instruction, accumulator);

      // Identify ALT-backed mint accounts from MINT_ASSOCIATIONS: the device
      // signals these via 0x6d10 after receiving their ALT_RESOLUTION and
      // requires TOKEN_INFO immediately after. They are excluded from the plain
      // altResolutions loop and handled with hold-and-conditionally-stream.
      for (const { mintIndex } of records.info.mintAssociations) {
        const mintAccount = match.instruction.accounts[mintIndex];
        if (mintAccount?.altRef !== undefined) {
          accumulator.addMintAltRef(
            mintAccount.altRef.altAddress,
            mintAccount.altRef.entryIndex,
          );
        }
      }

      applyTrustedNameRule(
        records,
        match.instruction,
        accumulator,
        bs58Encoder,
      );
    }

    return Right(accumulator.build());
  } catch (error) {
    // Parsers (e.g. poolFromJson) signal malformed descriptors by throwing.
    return Left(
      new RequirementsDecodeError(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}
