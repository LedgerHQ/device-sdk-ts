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
 * Payload for ClearSignContextType.SOLANA_INSTRUCTION_INFO: one signed
 * INSTRUCTION_INFO descriptor plus its substructures.
 */
export type SolanaInstructionInfoPayload = {
  programId: string;
  discriminator: string;
  instructionInfo: SolanaSignedDescriptor;
  substructures: SolanaInstructionSubstructure[];
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

// SOLANA_TRUSTED_NAME already exists with `payload: Uint8Array`, emitted by
// both OwnerInfoContextLoader and SolanaTrustedNameContextLoader.
