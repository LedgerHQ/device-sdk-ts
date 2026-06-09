import { type VariantCache } from "@internal/app-binder/clear-sign/idl-type-pool";

/** Kind byte tagging an INSTRUCTION_INFO substructure descriptor. */
export enum SubstructureKind {
  DISPLAY_FIELD = 0x00,
  VALUE_FLOW_PORT = 0x01,
  HIDE_RULE = 0x02,
  ACCOUNT_RESET = 0x03,
}

/** A `(altAddress, entryIndex)` reference into an Address Lookup Table. */
export type AltEntryKey = { altAddress: string; entryIndex: number };

/**
 * One account slot of an instruction. `address` is the resolved base58 key;
 * it is `undefined` for ALT-supplied slots that are not resolved at
 * requirement-build time (DMK does not talk to RPC) — those still carry an
 * `altRef` so an `ALT_RESOLUTION` requirement can be emitted.
 */
export type RequirementAccount = {
  address?: string;
  altRef?: AltEntryKey;
};

export type RequirementInstruction = {
  programId: string;
  accounts: RequirementAccount[];
  data: Uint8Array;
};

/** One substructure descriptor as delivered by CAL (opaque TLV bytes). */
export type SubstructureDescriptor = {
  kind: SubstructureKind;
  data: Uint8Array;
};

/** The matched CAL descriptor for one instruction. */
export type InstructionDescriptor = {
  discriminator: string;
  instructionInfo: Uint8Array;
  substructures: SubstructureDescriptor[];
  enumCache: VariantCache;
};

/** A transaction instruction paired with its matched CAL descriptor. */
export type MatchedInstruction = {
  instruction: RequirementInstruction;
  descriptor: InstructionDescriptor;
};

// ---- output ---------------------------------------------------------------

export type ProgramDiscriminator = { programId: string; discriminator: string };

export type EnumVariantKey = {
  programId: string;
  enumId: string;
  variantIndex: number;
};

/** The deduplicated set of descriptors the device needs, per descriptor type. */
export type DescriptorRequirements = {
  instructionInfos: ProgramDiscriminator[];
  enumVariants: EnumVariantKey[];
  tokenInfos: string[];
  tokenAccountStates: string[];
  altResolutions: AltEntryKey[];
  trustedNames: string[];
};
