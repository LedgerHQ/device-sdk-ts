import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptions = {
  transactionResolutionContext?: TransactionResolutionContext;
  solanaRPCURL?: string;
  tokenInternalId?: string;
  templateId?: string;
  skipOpenApp?: boolean;
};
