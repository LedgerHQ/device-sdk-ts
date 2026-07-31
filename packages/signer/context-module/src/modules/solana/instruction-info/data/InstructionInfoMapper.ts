// Maps the validated CAL instruction-descriptor DTOs into the core
// `SolanaInstructionInfoPayload` model. Keeping this in the data layer means
// the domain `InstructionInfoContextLoader` never has to know the CAL DTO
// shapes — it consumes core models only.

import { type Either, Left, Right } from "purify-ts";

import {
  type SolanaCalAccountReset,
  type SolanaCalDisplayField,
  type SolanaCalValueFlowPort,
  type SolanaInstructionEnumVariant,
  type SolanaInstructionInfoPayload,
  type SolanaInstructionSubstructure,
  SolanaInstructionSubstructureKind,
} from "@/modules/solana/model/SolanaPayloads";
import { u16Codec } from "@/shared/utils/uIntCodec";

import {
  type CalAccountResetDto,
  type CalDisplayFieldDto,
  type CalInstructionDescriptorDto,
  type CalSignatures,
  type CalValueFlowPortDto,
} from "./InstructionInfoDto";

export type CalMode = "prod" | "test";

function pickSignature(
  signatures: CalSignatures,
  mode: CalMode,
): string | undefined {
  return signatures[mode];
}

// --- DTO → decoded-payload projections. Pick only the fields the host-side
// requirement builder reads, dropping the signed-TLV `descriptor` carried by
// the DTO. ---

export function toValueFlowPorts(
  dtos: CalValueFlowPortDto[] = [],
): SolanaCalValueFlowPort[] {
  return dtos.map((port) => ({
    account_indices: port.account_indices,
    optional_account_strategy: port.optional_account_strategy,
    token_value: port.token_value,
  }));
}

export function toAccountResets(
  dtos: CalAccountResetDto[] = [],
): SolanaCalAccountReset[] {
  // Drop malformed resets (missing account_index) rather than defaulting to
  // slot 0, which would create an unintended TOKEN_ACCOUNT_STATE requirement.
  return dtos.flatMap((reset) =>
    reset.account_index === undefined
      ? []
      : [
          {
            account_index: reset.account_index,
            require_pre_balance_zero: reset.require_pre_balance_zero,
          },
        ],
  );
}

export function toDisplayFields(
  dtos: CalDisplayFieldDto[] = [],
): SolanaCalDisplayField[] {
  return dtos.map((field) => ({
    name: field.name,
    param: field.param ?? { type: "" },
  }));
}

function toSubstructures(
  dto: CalInstructionDescriptorDto,
): SolanaInstructionSubstructure[] {
  return [
    ...(dto.display_fields ?? []).map((s) => ({
      kind: SolanaInstructionSubstructureKind.DISPLAY_FIELD,
      data: s.descriptor,
    })),
    ...(dto.value_flow_ports ?? []).map((s) => ({
      kind: SolanaInstructionSubstructureKind.VALUE_FLOW_PORT,
      data: s.descriptor,
    })),
    ...(dto.hide_rules ?? []).map((s) => ({
      kind: SolanaInstructionSubstructureKind.HIDE_RULE,
      data: s.descriptor,
    })),
    ...(dto.account_resets ?? []).map((s) => ({
      kind: SolanaInstructionSubstructureKind.ACCOUNT_RESET,
      data: s.descriptor,
    })),
  ];
}

/**
 * Flatten the CAL-bundled enum variants (keyed enumId → variantIndex). Keys
 * that don't validate as a u16 are skipped rather than leaking NaN/out-of-range
 * indices into the payload.
 */
function toEnumVariants(
  dto: CalInstructionDescriptorDto,
  mode: CalMode,
): SolanaInstructionEnumVariant[] {
  const enumVariants: SolanaInstructionEnumVariant[] = [];
  for (const [enumId, variants] of Object.entries(dto.enum_variants ?? {})) {
    for (const [variantIndex, variant] of Object.entries(variants)) {
      const index = Number(variantIndex);
      if (u16Codec.decode(index).isLeft()) {
        continue;
      }
      enumVariants.push({
        enumId,
        variantIndex: index,
        descriptor: {
          data: variant.descriptor.data,
          signature: pickSignature(variant.descriptor.signatures, mode) ?? "",
        },
      });
    }
  }
  return enumVariants;
}

/**
 * Flatten the enum variants of every descriptor in a program into a single
 * list. CAL nests `enum_variants` inside each instruction descriptor but
 * guarantees `(enumId, variantIndex)` is unique across a program, so the enum
 * loader resolves a selection against this program-level list — independently
 * of whether any individual instruction descriptor carried a usable signature.
 */
export function toProgramEnumVariants(
  descriptors: Record<string, CalInstructionDescriptorDto>,
  mode: CalMode,
): SolanaInstructionEnumVariant[] {
  return Object.values(descriptors).flatMap((dto) => toEnumVariants(dto, mode));
}

/**
 * Transform one validated CAL descriptor DTO into the core
 * {@link SolanaInstructionInfoPayload}. Returns a `Left` when the descriptor is
 * unusable (no signature for the configured `mode`), so the caller can surface
 * a per-descriptor ERROR rather than emitting an empty signature.
 *
 * `programId` comes from the enclosing `solana_programs` envelope `id`;
 * `discriminator` from the instruction's `discriminator_hex`.
 */
export function toInstructionInfoPayload(
  programId: string,
  discriminator: string,
  dto: CalInstructionDescriptorDto,
  mode: CalMode,
): Either<Error, SolanaInstructionInfoPayload> {
  const signature = pickSignature(dto.descriptor.signatures, mode);
  if (!signature) {
    return Left(
      new Error(
        `[ContextModule] InstructionInfoDataSource: missing '${mode}' signature for (${programId}, ${discriminator})`,
      ),
    );
  }

  return Right({
    programId,
    discriminator,
    instructionInfo: {
      data: dto.descriptor.data,
      signature,
    },
    substructures: toSubstructures(dto),
    enumVariants: toEnumVariants(dto, mode),
    idlDescriptor: {
      typePool: dto.idl_descriptor?.type_pool ?? [],
      rootType: dto.idl_descriptor?.root_type ?? 0,
    },
    mintAssociations: dto.mint_association ? [dto.mint_association] : [],
    valueFlowPorts: toValueFlowPorts(dto.value_flow_ports),
    accountResets: toAccountResets(dto.account_resets),
    displayFields: toDisplayFields(dto.display_fields),
  });
}
