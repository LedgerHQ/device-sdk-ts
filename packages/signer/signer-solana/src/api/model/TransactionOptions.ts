import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptions = {
  transactionResolutionContext?: TransactionResolutionContext;
  solanaRPCURL?: string;
  skipOpenApp?: boolean;
};
