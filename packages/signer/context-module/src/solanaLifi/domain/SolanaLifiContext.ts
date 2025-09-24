import { type ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

type SolanaTransactionDescriptor = {
  data: string;
  descriptorType: string;
  descriptorVersion: string;
  signatures: {
    prod?: string;
    test?: string;
  };
};

export type SolanaTransactionDescriptorList = Record<
  string,
  SolanaTransactionDescriptor
>;

export type SolanaLifiContextResult = {
  type: ClearSignContextType.SOLANA_LIFI | ClearSignContextType.ERROR;
  payload?: SolanaTransactionDescriptorList;
  error?: Error;
};

export type SolanaLifiContext = {
  canHandle(SolanaContext: SolanaTransactionContext): boolean;
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<SolanaLifiContextResult>;
};
