export type TransactionOptions = {
  /**
   * Whether to skip opening the XRP app automatically.
   */
  skipOpenApp?: boolean;
  /**
   * Whether to use Ed25519 curve instead of secp256k1.
   * Default is secp256k1.
   */
  useEd25519?: boolean;
};
