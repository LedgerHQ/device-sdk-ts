// Solana payload types — used both by Solana loaders and (type-only)
// referenced by the shared ClearSignContext union for typed-payload variants.

export type SolanaTokenData = {
  solanaTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type SolanaTransactionDescriptor = {
  data: string;
  descriptorType: string;
  descriptorVersion: string;
  signature: string;
};

export type SolanaLifiInstructionMeta = {
  program_id: string;
  discriminator_hex?: string;
};

export type SolanaLifiPayload = {
  descriptors: Record<string, SolanaTransactionDescriptor>;
  instructions: SolanaLifiInstructionMeta[];
};

export type SolanaTransactionCheckPayload = {
  descriptor: string;
};

// --- Generic clear-signing payloads ---

// CAL static descriptor payloads. `data` is the signed TLV (hex string);
// `signature` is the resolved signature for the configured CAL signature
// kind (`prod` | `test`).

export type SolanaSignedDescriptor = {
  data: string;
  signature: string;
};

/**
 * One enum-variant descriptor bundled with an instruction descriptor by CAL.
 * The signed TLV (`descriptor.data`) feeds the host-side type-pool decode
 * cache, `enumId`/`variantIndex` identify which variant it describes (and let
 * the host stream the selected variant's signed descriptor to the device).
 */
export type SolanaInstructionEnumVariant = {
  enumId: string;
  variantIndex: number;
  descriptor: SolanaSignedDescriptor;
};

/**
 * Payload for ClearSignContextType.SOLANA_INSTRUCTION_INFO.
 *
 * `instructionInfo` + `substructures` are the signed TLVs streamed to the
 * device, and `enumVariants` are the signed enum-variant descriptors CAL
 * bundles for the program's enums (used to build the host decode cache). The
 * remaining fields are CAL's decoded JSON consumed host-side by the
 * requirement builder.
 */
export type SolanaInstructionInfoPayload = {
  programId: string;
  discriminator: string;
  instructionInfo: SolanaSignedDescriptor;
  substructures: SolanaInstructionSubstructure[];
  enumVariants: SolanaInstructionEnumVariant[];
  idlDescriptor: {
    typePool: SolanaCalTypePoolEntry[];
    rootType: number;
  };
  mintAssociations: SolanaCalMintAssociation[];
  valueFlowPorts: SolanaCalValueFlowPort[];
  accountResets: SolanaCalAccountReset[];
  displayFields: SolanaCalDisplayField[];
};

export enum SolanaInstructionSubstructureKind {
  DISPLAY_FIELD = 0x00,
  VALUE_FLOW_PORT = 0x01,
  HIDE_RULE = 0x02,
  ACCOUNT_RESET = 0x03,
}

export type SolanaInstructionSubstructure = {
  kind: SolanaInstructionSubstructureKind;
  // TLV payload (hex string) for the substructure.
  data: string;
};

// --- Decoded CAL JSON (snake_case mirrors the CAL response) ---

export type SolanaCalValue = {
  source: string;
  /** ACCOUNT_PATH: index into the instruction's accounts. */
  account_index?: number;
  /** CONSTANT: hex-encoded bytes. */
  data?: string;
  /** ARGUMENT_PATH: decoded steps. */
  path?: { steps: number[] };
};

export type SolanaCalTokenValue = {
  kind: string;
  value?: SolanaCalValue;
  account_index?: number;
};

export type SolanaCalValueFlowPort = {
  /** Ordered candidate list of account indices (length 1 for a single-account port). */
  account_indices: number[];
  optional_account_strategy?: string;
  token_value: SolanaCalTokenValue;
};

export type SolanaCalAccountReset = {
  account_index: number;
  require_pre_balance_zero?: boolean;
};

export type SolanaCalDisplayField = {
  name?: string;
  param: { type: string; value?: SolanaCalValue; token?: SolanaCalValue };
};

export type SolanaCalTypePoolEntry = {
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

export type SolanaCalMintAssociation = {
  account_index: number;
  mint_index: number;
};

/**
 * Payload for ClearSignContextType.SOLANA_ENUM_VARIANT: one signed
 * ENUM_VARIANT descriptor for a `(programId, enumId, variantIndex)` triple.
 */
export type SolanaEnumVariantPayload = {
  programId: string;
  enumId: string;
  variantIndex: number;
  descriptor: SolanaSignedDescriptor;
};

/**
 * Payload for ClearSignContextType.SOLANA_TOKEN_INFO, keyed by mint pubkey.
 * Distinct from the legacy SOLANA_TOKEN context.
 */
export type SolanaTokenInfoPayload = {
  mint: string;
  descriptor: SolanaSignedDescriptor;
};

// --- Dynamic descriptor payloads (challenge-bound) ---
//
// Each payload carries the raw signed TLV bytes decoded from the backend's
// hex `signedDescriptor`.

export type SolanaTokenAccountStatePayload = {
  descriptor: Uint8Array;
};

export type SolanaAltResolutionPayload = {
  descriptor: Uint8Array;
};

// SOLANA_TRUSTED_NAME (generic flow, with 2-byte length prefix) is emitted by
// SolanaTrustedNameContextLoader. SOLANA_BASIC_TRUSTED_NAME (basic flow, raw
// bytes) is emitted by OwnerInfoContextLoader. Both carry `payload: Uint8Array`.
