import { type VariantCache } from "@internal/app-binder/clear-sign/idl-type-pool";

import {
  type CalAccountReset,
  type CalDisplayField,
  type CalIdlDescriptor,
  type CalMintAssociation,
  type CalValueFlowPort,
} from "./calTypes";

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

/**
 * The matched CAL descriptor for one instruction, as decoded JSON. These fields
 * drive host-side requirement building only (see {@link parseInstructionDescriptor}).
 */
export type InstructionDescriptor = {
  discriminator: string;
  idlDescriptor: CalIdlDescriptor;
  mintAssociations: CalMintAssociation[];
  valueFlowPorts: CalValueFlowPort[];
  accountResets: CalAccountReset[];
  displayFields: CalDisplayField[];
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
  /**
   * PARAM_TOKEN_AMOUNT.TOKEN refs (ACCOUNT_PATH, non-ALT, not in mintBindings).
   * Try TOKEN_INFO first at fetch time; fall back to TOKEN_ACCOUNT_STATE if it fails.
   */
  tokenAmountRefs: string[];
  /**
   * PARAM_TOKEN_AMOUNT.TOKEN refs backed by ALT entries (not resolvable at build time).
   * After ALT_RESOLUTION is fetched, resolve the address and apply the same
   * TOKEN_INFO-first / TOKEN_ACCOUNT_STATE-fallback logic.
   */
  tokenAmountAltRefs: AltEntryKey[];
  /**
   * ALT-backed MINT entries from MINT_ASSOCIATIONS (accounts at a `mint_index`
   * that have no resolved address). The device may signal these via status
   * 0x6d10 after receiving ALT_RESOLUTION; TOKEN_INFO is then streamed best-effort.
   * They are excluded from `altResolutions` and handled with
   * hold-and-conditionally-stream logic in the provide phase.
   */
  mintAltRefs: AltEntryKey[];
};
