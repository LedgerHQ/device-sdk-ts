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

export type SolanaContextSuccessType =
  | ClearSignContextType.SOLANA_TOKEN
  | ClearSignContextType.SOLANA_LIFI;

export type SolanaContextSuccess<
  T extends SolanaContextSuccessType = SolanaContextSuccessType,
> = ClearSignContextSuccess<T>;

export type SolanaContextError = ClearSignContextError;

export type SolanaContext =
  | ClearSignContextSuccess<
      ClearSignContextType.SOLANA_TOKEN | ClearSignContextType.SOLANA_LIFI
    >
  | ClearSignContextError;

export type SolanaTokenContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_TOKEN>;

export type SolanaLifiContextSuccess =
  ClearSignContextSuccess<ClearSignContextType.SOLANA_LIFI>;

export type SolanaTokenContextResult =
  | SolanaTokenContextSuccess
  | SolanaContextError;

export type SolanaLifiContextResult =
  | SolanaLifiContextSuccess
  | SolanaContextError;

export type LoaderResult = SolanaTokenContextResult | SolanaLifiContextResult;
