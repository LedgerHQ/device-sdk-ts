import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";

export type SolanaTokenData = {
  solanaTokenDescriptor: {
    data: string;
    signature: string;
  };
};

export type SolanaTokenContextResult = {
  type: ClearSignContextType.SOLANA_TOKEN | ClearSignContextType.ERROR;
  certificate?: PkiCertificate;
  payload?: SolanaTokenData;
  error?: Error;
};

export type SolanaTokenContext = {
  canHandle(SolanaContext: SolanaTransactionContext): boolean;
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<SolanaTokenContextResult>;
};
