import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptionalConfig = {
  transactionResolutionContext?: TransactionResolutionContext;
  /** When set, overrides the signer-level RPC URL for this call. */
  solanaRPCURL?: string;
  skipOpenApp?: boolean;
  delayed?: boolean;
  fetchBlockhash?: () => Promise<Uint8Array>;
};
