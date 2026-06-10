// DTO + codecs for the CAL instruction-descriptors response (one object per
// `programId`, wrapped in a JSON array).
//
// The hand-written types describe the consumed shape (with genuinely optional
// `?:` fields); the codecs below validate that shape at runtime so
// `HttpInstructionInfoDataSource` can hand the loaders a payload they can
// dereference without runtime-throwing on a malformed descriptor.

import { array, Codec, optional, record, string } from "purify-ts";

export type CalSignatures = {
  prod?: string;
  test?: string;
};

export type CalSignedDescriptorDto = {
  data: string;
  signatures: CalSignatures;
};

export type CalInstructionInfoDto = {
  version: number;
  program_id: string;
  discriminator: string;
  hash: string;
  operation_type?: string;
  program_name?: string;
  descriptor: CalSignedDescriptorDto;
  idl_descriptor?: {
    type_pool?: unknown;
    root_type?: number;
  };
  mint_association?: unknown;
  owner_association?: unknown;
};

export type CalEnumVariantDto = {
  variant_name: string;
  payload_kind?: string;
  data: string;
  signatures: CalSignatures;
};

export type CalSubstructureDto = {
  descriptor: string;
};

export type CalInstructionDescriptorDto = {
  type: string;
  source?: string;
  network?: string;
  version?: string;
  instruction_info: CalInstructionInfoDto;
  enum_variants?: Record<string, Record<string, CalEnumVariantDto>>;
  display_fields?: CalSubstructureDto[];
  value_flow_ports?: CalSubstructureDto[];
  hide_rules?: CalSubstructureDto[];
  account_resets?: CalSubstructureDto[];
};

// Outer shape: array containing one envelope object keyed by program_id
// then by discriminator hex.
export type CalInstructionInfoResponseDto = Array<{
  descriptors_instruction: Record<
    string,
    Record<string, CalInstructionDescriptorDto>
  >;
}>;

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

const calInstructionInfoCodec = Codec.interface({
  program_id: string,
  descriptor: calSignedDescriptorCodec,
});

const calEnumVariantCodec = Codec.interface({
  data: string,
  signatures: calSignaturesCodec,
});

const calSubstructureCodec = Codec.interface({
  descriptor: string,
});

const calInstructionDescriptorCodec = Codec.interface({
  instruction_info: calInstructionInfoCodec,
  enum_variants: optional(record(string, record(string, calEnumVariantCodec))),
  display_fields: optional(array(calSubstructureCodec)),
  value_flow_ports: optional(array(calSubstructureCodec)),
  hide_rules: optional(array(calSubstructureCodec)),
  account_resets: optional(array(calSubstructureCodec)),
});

/**
 * Codec for the per-program descriptor map (keyed by discriminator hex).
 * Used by the datasource to validate the inner CAL payload before handing
 * it to the loaders. Only loader-consumed fields are validated; unrelated
 * CAL fields (`idl_descriptor`, `mint_association`, …) are ignored.
 */
export const calInstructionDescriptorsCodec = record(
  string,
  calInstructionDescriptorCodec,
);
