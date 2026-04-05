export type SolanaTransactionData = {
  /** Base64-encoded serialised transaction */
  rawTx: string;
  /** Transaction signature (hash) */
  signature: string;
  /** Classification label (e.g. "system:transfer", "spl:transferChecked") */
  category: string;
};
