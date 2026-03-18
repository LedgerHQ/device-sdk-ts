import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptionalConfig = {
  transactionResolutionContext?: TransactionResolutionContext;
  solanaRPCURL?: string;
  skipOpenApp?: boolean;
  delayed?: boolean;
  fetchBlockhash?: () => Promise<Uint8Array>;
};
