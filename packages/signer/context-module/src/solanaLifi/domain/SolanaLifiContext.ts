import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import { type SolanaContextTypes } from "@/solanaToken/domain/SolanaTokenContext";

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

export type SolanaLifiContextSuccessResult = {
  type: SolanaContextTypes.SOLANA_LIFI;
  payload?: SolanaTransactionDescriptorList;
};

export type SolanaLifiContextErrorResult = {
  type: SolanaContextTypes.ERROR;
  error?: Error;
};

export type SolanaLifiContextResult =
  | SolanaLifiContextSuccessResult
  | SolanaLifiContextErrorResult;

export type SolanaLifiContext = {
  canHandle(SolanaContext: SolanaTransactionContext): boolean;
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<SolanaLifiContextResult>;
};
