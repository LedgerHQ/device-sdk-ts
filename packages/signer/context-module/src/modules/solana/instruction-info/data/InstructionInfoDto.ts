// DTO + codecs for the CAL instruction-descriptors response (one object per
// `programId`, wrapped in a JSON array).
//
// The hand-written types describe the consumed shape (with genuinely optional
// `?:` fields); the codecs below validate that shape at runtime so
// `HttpInstructionInfoDataSource` can hand the loaders a payload they can
// dereference without runtime-throwing on a malformed descriptor.

import {
  array,
  Codec,
  Left,
  number,
  optional,
  record,
  Right,
  string,
} from "purify-ts";

import { u8Codec } from "@/shared/utils/uIntCodec";

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
  /** `RESOLVE` only: account index whose address is the mint of last resort. */
  fallback_account?: number;
};

export type CalMintAssociationDto = {
  account_index: number;
  mint_index: number;
};

// Neither half is codec-validated, and the spec requires both or neither, so
// both are optional here and the mapper drops a half-declared pair.
export type CalOwnerAssociationDto = {
  account_index?: number;
  owner?: CalValueDto;
};

/** One `ACTIVE_WHEN` predicate: a bare name, or `MINT_PREDICATE` + its mint. */
export type CalActiveWhenPredicateDto =
  | string
  | { kind: string; mint?: string };

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
  active_when?: CalActiveWhenPredicateDto[];
};

export type CalHideRuleDto = CalSubstructureDto & {
  rule_set_index?: number;
  target?: CalValueDto;
  condition?: string;
};

export type CalAccountResetDto = CalSubstructureDto & {
  account_index?: number;
  require_pre_balance_zero?: boolean;
  value_kind?: string;
  token?: CalTokenValueDto;
  require_native_pre_balance_zero?: boolean;
  /**
   * Parsed view of the reset's `RESET_SCOPE`, served next to the signed TLV.
   * Informative only: the device reads the TLV. Not covered by the program
   * codec: the mapper validates it with {@link calResetScopeCodec}, so a
   * malformed view drops the view and keeps the reset.
   */
  reset_scope?: CalResetScopeDto;
};

/** One `RESET_SCOPE.WITNESS_CONSUMER`. */
export type CalResetScopeWitnessConsumerDto = {
  /** Discriminator prefix (hex, 0 to 8 bytes) the consumer's data starts with. */
  discriminator: string;
  /** Index, in the consumer's accounts, of the account that must be the ledger. */
  account_index: number;
};

/** A plain scope (`discriminators`) or a witnessed one (`witness`), never both. */
export type CalResetScopeDto = {
  program_id: string;
  discriminators?: string[];
  witness?: {
    /** Index, in the declaring instruction's accounts, of the ledger. */
    reset_account_index: number;
    consumers: CalResetScopeWitnessConsumerDto[];
  };
};

export type CalSlotConstraintDto = {
  signer: string;
  writable: string;
};

export type CalAccountSchemaDto = {
  count_min?: number;
  count_max?: number;
  remaining_policy?: CalSlotConstraintDto;
  slots?: CalSlotConstraintDto[];
};

export type CalDisplayFieldDto = CalSubstructureDto & {
  name?: string;
  param?: { type: string; value?: CalValueDto; token?: CalValueDto };
};

export type CalInstructionDescriptorDto = {
  discriminator_hex?: string;
  instruction_name?: string;
  descriptor: CalSignedDescriptorDto;
  idl_descriptor?: {
    type_pool?: CalTypePoolEntryDto[];
    root_type?: number;
  };
  mint_association?: CalMintAssociationDto;
  owner_association?: CalOwnerAssociationDto;
  enum_variants?: Record<string, Record<string, CalEnumVariantDto>>;
  display_fields?: CalDisplayFieldDto[];
  value_flow_ports?: CalValueFlowPortDto[];
  hide_rules?: CalHideRuleDto[];
  account_resets?: CalAccountResetDto[];
  /** Absent means "no ACCOUNT_SCHEMA check". */
  account_schema?: CalAccountSchemaDto;
  /**
   * Host-side routing tags, outside the signed `descriptor`. Not covered by
   * the program codec: the mapper validates it on its own with
   * {@link calSigningRouteCodec} so a malformed value only drops the tags.
   */
  signing_route?: CalSigningRouteDto;
};

/** `role` is `"required"` or `"allowed"`; the mapper drops any other value. */
export type CalSigningRouteEntryDto = {
  rule: string;
  role: string;
};

export type CalSigningRouteDto = {
  basic_flow?: CalSigningRouteEntryDto[];
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

const calSlotConstraintCodec = Codec.interface({
  signer: string,
  writable: string,
});

const calAccountSchemaCodec = Codec.interface({
  count_min: optional(number),
  count_max: optional(number),
  remaining_policy: optional(calSlotConstraintCodec),
  slots: optional(array(calSlotConstraintCodec)),
});

const calInstructionDescriptorCodec = Codec.interface({
  discriminator_hex: optional(string),
  descriptor: calSignedDescriptorCodec,
  enum_variants: optional(record(string, record(string, calEnumVariantCodec))),
  display_fields: optional(array(calSubstructureCodec)),
  value_flow_ports: optional(array(calSubstructureCodec)),
  hide_rules: optional(array(calSubstructureCodec)),
  account_resets: optional(array(calSubstructureCodec)),
  account_schema: optional(calAccountSchemaCodec),
});

/**
 * Codec for one instruction's `signing_route`. Kept out of
 * `calInstructionDescriptorCodec` on purpose: routing tags are optional
 * metadata, and a malformed value must not invalidate the program's
 * clear-signing descriptors.
 */
export const calSigningRouteCodec = Codec.interface({
  basic_flow: optional(
    array(
      Codec.interface({
        rule: string,
        role: string,
      }),
    ),
  ),
});

/** A discriminator prefix: 0 to 8 bytes, as an even-length hex string. */
const calDiscriminatorPrefixCodec = Codec.custom<string>({
  decode: (value) =>
    typeof value === "string" && /^(?:[0-9a-fA-F]{2}){0,8}$/.test(value)
      ? Right(value)
      : Left("Expected a discriminator prefix of 0 to 8 hex bytes"),
  encode: (value) => value,
});

/**
 * Codec for one reset's `reset_scope` view. Kept out of
 * `calInstructionDescriptorCodec` on purpose, like {@link calSigningRouteCodec}:
 * the view only decides which ALT entries the host streams, and a malformed one
 * must not invalidate the program's clear-signing descriptors.
 */
export const calResetScopeCodec = Codec.interface({
  program_id: string,
  discriminators: optional(array(calDiscriminatorPrefixCodec)),
  witness: optional(
    Codec.interface({
      reset_account_index: u8Codec,
      consumers: array(
        Codec.interface({
          discriminator: calDiscriminatorPrefixCodec,
          account_index: u8Codec,
        }),
      ),
    }),
  ),
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
