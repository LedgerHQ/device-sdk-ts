export type TransactionOptions = {
  skipOpenApp?: boolean;
  /**
   * TRC10 token name signatures, as hex strings, appended after the
   * transaction frames during signing (matches `@ledgerhq/hw-app-trx`).
   */
  tokenSignatures?: string[];
};
