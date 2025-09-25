import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptionalConfig = {
  transactionResolutionContext?: TransactionResolutionContext;
  solanaRPCURL?: string;
  tokenInternalId?: string;
  templateId?: string;
  skipOpenApp?: boolean;
};
