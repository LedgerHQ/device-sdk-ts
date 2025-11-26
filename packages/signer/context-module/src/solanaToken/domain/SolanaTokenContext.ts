import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

export type SolanaTokenData = {
  solanaTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type SolanaTokenContextSuccessResult = {
  type: SolanaContextTypes.SOLANA_TOKEN;
  certificate?: PkiCertificate;
  payload: SolanaTokenData;
};

export type SolanaTokenContextErrorResult = {
  type: SolanaContextTypes.ERROR;
  error?: Error;
};

export type SolanaTokenContextResult =
  | SolanaTokenContextSuccessResult
  | SolanaTokenContextErrorResult;

export type SolanaTokenContext = {
  canHandle(SolanaContext: SolanaTransactionContext): boolean;
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<SolanaTokenContextResult>;
};

export enum SolanaContextTypes {
  SOLANA_TOKEN = "solanaToken",
  SOLANA_LIFI = "solanaLifi",
  ERROR = "solana context error",
}
