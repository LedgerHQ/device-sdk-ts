import { type TransactionResolutionContext } from "./TransactionResolutionContext";

export type SolanaTransactionOptionalConfig = {
  transactionResolutionContext?: TransactionResolutionContext;
  /** When set, overrides the signer-level RPC URL for this call. */
  solanaRPCURL?: string;
  skipOpenApp?: boolean;
  delayed?: boolean;
  fetchBlockhash?: () => Promise<Uint8Array>;
  /**
   * Full wire-format serialized transaction (`tx.serialize()`). When provided,
   * co-signer signatures already present in this blob are forwarded in the
   * Transaction Check payload instead of being zero-filled. Never sent to the
   * device. Must serialize the same message as `transaction`. When delayed
   * signing refreshes the blockhash, Transaction Check uses a blockhash-zeroed
   * preview message, so a blob for the original transaction will be ignored.
   */
  serializedTransactionForTransactionCheck?: Uint8Array;
};
