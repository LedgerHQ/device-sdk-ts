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
  descriptor: SolanaTransactionDescriptorRaw;
};

export type GetTransactionDescriptorsResponse = {
  id: string;
  chain_id: number;
  instructions: Array<{
    program_id: string;
    discriminator?: number;
    discriminator_hex?: string;
  }>;
  descriptors: SolanaLifiDescriptorEntry[];
};

export type SolanaTransactionDescriptorList = Record<
  string,
  SolanaTransactionDescriptor
>;

// TODO SOLANA TX-CHECK
// IMPORTANT: do not widen this union with the new clear-signing context
// types (SOLANA_INSTRUCTION_INFO, SOLANA_ENUM_VARIANT, SOLANA_TOKEN_INFO,
// SOLANA_TOKEN_ACCOUNT_STATE, SOLANA_ALT_RESOLUTION) until the
// downstream signer registry declares matching handlers. That registry
// uses a required mapped type over this union, so widening here without
// adding handlers breaks the signer build.
export type SolanaContextSuccessType =
  | ClearSignContextType.SOLANA_TOKEN
  | ClearSignContextType.SOLANA_LIFI
  | ClearSignContextType.SOLANA_TRANSACTION_CHECK;

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
