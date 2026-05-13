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
