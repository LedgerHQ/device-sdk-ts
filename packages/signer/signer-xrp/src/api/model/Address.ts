export type Address = {
  /**
   * The public key the application returned, hex encoded. Its width is not
   * fixed: app-xrp compresses it to 33 bytes, while the APDU spec describes an
   * uncompressed 65 byte key. The app length-prefixes it and it is parsed by
   * that prefix, so callers should not assume either size.
   */
  readonly publicKey: string;
  /**
   * The XRP address. The application returns it as ASCII and it is passed
   * through as-is — unlike the Ethereum signer, there is no `0x` prefix.
   */
  readonly address: string;
  /** BIP32 chain code, hex encoded. Only set when it was requested. */
  readonly chainCode?: string;
};
