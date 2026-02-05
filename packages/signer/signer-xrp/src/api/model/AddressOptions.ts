export type AddressOptions = {
  /**
   * Whether to display the address on the device for verification.
   */
  checkOnDevice?: boolean;
  /**
   * Whether to skip opening the XRP app automatically.
   */
  skipOpenApp?: boolean;
  /**
   * Whether to return the chain code along with the address.
   */
  returnChainCode?: boolean;
  /**
   * Whether to use Ed25519 curve instead of secp256k1.
   * Default is secp256k1.
   */
  useEd25519?: boolean;
};
