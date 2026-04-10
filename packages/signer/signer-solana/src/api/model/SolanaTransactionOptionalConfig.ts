import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptionalConfig = {
  transactionResolutionContext?: TransactionResolutionContext;
  /** When set, overrides the signer default RPC URL for this sign only. */
  solanaRPCURL?: string;
  skipOpenApp?: boolean;
  delayed?: boolean;
  fetchBlockhash?: () => Promise<Uint8Array>;
};
