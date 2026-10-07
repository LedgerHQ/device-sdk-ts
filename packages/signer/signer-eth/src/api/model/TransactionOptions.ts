export type TransactionOptions = {
  skipOpenApp?: boolean;
  /**
   * Use the generic parser even when the transaction info has no certificate.
   * Only an app build carrying a calldata test key accepts it; a production app refuses it.
   */
  allowUncertifiedTransactionInfo?: boolean;
};
