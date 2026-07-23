import { type SolanaTransactionDescriptor } from "@/modules/solana/model/SolanaPayloads";
import {
  type ClearSignContextError,
  type ClearSignContextSuccess,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type SolanaTransactionDescriptorRaw = {
  data: string;
  descriptorType: string;
  descriptorVersion: string;
  signatures: {
    prod?: string;
    test?: string;
  };
};

export type SolanaLifiDescriptorEntry = {
  program_id: string;
  discriminator_hex?: string;
  has_basis_point?: boolean;
  descriptor: SolanaTransactionDescriptorRaw;
};

export type GetTransactionDescriptorsResponse = {
  id: string;
  chain_id: number;
  instructions: Array<{
    program_id: string;
    discriminator?: number;
    discriminator_hex?: string;
    amount?: { capped_bps?: number };
  }>;
  descriptors: SolanaLifiDescriptorEntry[];
};

export type SolanaTransactionDescriptorList = Record<
  string,
  SolanaTransactionDescriptor[]
>;

// The signer registry (`provideContextRegistry.ts`) uses a required mapped
// type over this union, so every member listed here MUST have a matching
// provide handler in the signer. The generic clear-signing types below are
// declared together with their handlers
export type SolanaContextSuccessType =
  | ClearSignContextType.SOLANA_TOKEN
  | ClearSignContextType.SOLANA_LIFI
  | ClearSignContextType.SOLANA_TRANSACTION_CHECK
  | ClearSignContextType.SOLANA_INSTRUCTION_INFO
  | ClearSignContextType.SOLANA_ENUM_VARIANT
  | ClearSignContextType.SOLANA_TOKEN_INFO
  | ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE
  | ClearSignContextType.SOLANA_ALT_RESOLUTION
  | ClearSignContextType.SOLANA_TRUSTED_NAME
  | ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME;

export type SolanaContextSuccess<
  T extends SolanaContextSuccessType = SolanaContextSuccessType,
> = ClearSignContextSuccess<T>;

export type SolanaContextError = ClearSignContextError;

export type SolanaContext = SolanaContextSuccess | SolanaContextError;

export type SolanaTokenContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TOKEN>;

export type SolanaLifiContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_LIFI>;

export type SolanaTransactionCheckContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TRANSACTION_CHECK>;

export type SolanaInstructionInfoContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_INSTRUCTION_INFO>;

export type SolanaEnumVariantContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_ENUM_VARIANT>;

export type SolanaTokenInfoContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TOKEN_INFO>;

export type SolanaTokenAccountStateContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE>;

export type SolanaAltResolutionContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_ALT_RESOLUTION>;

export type SolanaTrustedNameContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TRUSTED_NAME>;

export type SolanaBasicTrustedNameContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME>;

export type SolanaTokenContextResult =
  | SolanaTokenContextSuccess
  | SolanaContextError;

export type SolanaLifiContextResult =
  | SolanaLifiContextSuccess
  | SolanaContextError;

export type SolanaTransactionCheckContextResult =
  | SolanaTransactionCheckContextSuccess
  | SolanaContextError;

export type LoaderResult =
  | SolanaTokenContextResult
  | SolanaLifiContextResult
  | SolanaTransactionCheckContextResult;
