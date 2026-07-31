// DTO + codecs for the CAL instruction-descriptors response (one object per
// `programId`, wrapped in a JSON array).
//
// The hand-written types describe the consumed shape (with genuinely optional
// `?:` fields); the codecs below validate that shape at runtime so
// `HttpInstructionInfoDataSource` can hand the loaders a payload they can
// dereference without runtime-throwing on a malformed descriptor.

import { array, Codec, number, optional, record, string } from "purify-ts";

export type CalSignatures = {
  prod?: string;
  test?: string;
};

export type CalSignedDescriptorDto = {
  data: string;
  signatures: CalSignatures;
};

// Decoded CAL JSON shapes (snake_case mirrors the CAL response) that drive
// host-side requirement building.

export type CalValueDto = {
  source: string;
  account_index?: number;
  data?: string;
  path?: { steps: number[] };
};

export type CalTokenValueDto = {
  kind: string;
  value?: CalValueDto;
  account_index?: number;
};

export type CalMintAssociationDto = {
  account_index: number;
  mint_index: number;
};

export type CalTypePoolEntryDto = {
  index: number;
  kind: string;
  refs?: number[];
  size?: number;
  encoding?: number;
  len_kind?: string;
  flag_kind?: string;
  sentinel?: string;
  disc_kind?: string;
  total_variants?: number;
  enum_id?: string;
};

export type CalEnumVariantDto = {
  variant_name: string;
  payload_kind?: string;
  descriptor: CalSignedDescriptorDto;
};

/** A substructure CAL serves only as opaque TLV (e.g. HIDE_RULE). */
export type CalSubstructureDto = {
  descriptor: string;
};

export type CalValueFlowPortDto = CalSubstructureDto & {
  account_indices: number[];
  optional_account_strategy?: string;
  token_value: CalTokenValueDto;
};

export type CalAccountResetDto = CalSubstructureDto & {
  account_index?: number;
  require_pre_balance_zero?: boolean;
};

export type CalDisplayFieldDto = CalSubstructureDto & {
  name?: string;
  param?: { type: string; value?: CalValueDto; token?: CalValueDto };
};

export type CalInstructionDescriptorDto = {
  discriminator_hex: string;
  instruction_name?: string;
  descriptor: CalSignedDescriptorDto;
  idl_descriptor?: {
    type_pool?: CalTypePoolEntryDto[];
    root_type?: number;
  };
  mint_association?: CalMintAssociationDto;
  owner_association?: unknown;
  enum_variants?: Record<string, Record<string, CalEnumVariantDto>>;
  display_fields?: CalDisplayFieldDto[];
  value_flow_ports?: CalValueFlowPortDto[];
  hide_rules?: CalSubstructureDto[];
  account_resets?: CalAccountResetDto[];
};

// One program object of the `solana_programs` response: the program `id`, its
// `chain_id`, and the flat `instructions` array (keyed downstream by
// `discriminator_hex`).
export type CalInstructionProgramDto = {
  id: string;
  chain_id: number;
  instructions: CalInstructionDescriptorDto[];
};

// Outer shape: array of program objects (one per requested `id`).
export type CalInstructionInfoResponseDto = CalInstructionProgramDto[];

// --- Validation codecs (runtime). Validate only the fields the loaders read;
// `Codec.interface` ignores unknown extras so CAL can add fields freely. ---

const calSignaturesCodec = Codec.interface({
  prod: optional(string),
  test: optional(string),
});

const calSignedDescriptorCodec = Codec.interface({
  data: string,
  signatures: calSignaturesCodec,
});

const calEnumVariantCodec = Codec.interface({
  descriptor: calSignedDescriptorCodec,
});

const calSubstructureCodec = Codec.interface({
  descriptor: string,
});

const calInstructionDescriptorCodec = Codec.interface({
  discriminator_hex: string,
  descriptor: calSignedDescriptorCodec,
  enum_variants: optional(record(string, record(string, calEnumVariantCodec))),
  display_fields: optional(array(calSubstructureCodec)),
  value_flow_ports: optional(array(calSubstructureCodec)),
  hide_rules: optional(array(calSubstructureCodec)),
  account_resets: optional(array(calSubstructureCodec)),
});

/**
 * Codec for one program object of the `solana_programs` response. Used by the
 * datasource to validate the CAL payload before handing it to the loaders.
 * Only loader-consumed fields are validated; unrelated CAL fields
 * (`idl_descriptor`, `mint_association`, …) are ignored.
 */
export const calInstructionProgramCodec = Codec.interface({
  id: string,
  chain_id: number,
  instructions: array(calInstructionDescriptorCodec),
});
