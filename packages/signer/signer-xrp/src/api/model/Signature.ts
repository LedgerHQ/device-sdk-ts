/**
 * XRP Signature
 *
 * XRP uses DER-encoded signatures. The signature is returned as a hex string
 * that can be directly used in transaction serialization.
 */
export type Signature = {
  /**
   * The DER-encoded signature as a hex string.
   * This is the full signature that should be included in the transaction.
   */
  r: string;
  /**
   * Not used for XRP DER signatures - kept for interface compatibility.
   */
  s: string;
  /**
   * Not used for XRP signatures - kept for interface compatibility.
   */
  v?: number;
};
