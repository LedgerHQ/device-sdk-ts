export type MessageOptions = {
  skipOpenApp?: boolean;
  /**
   * The application domain to include in the off-chain message header
   * (per the Anza off-chain message signing spec).
   * Encoded as UTF-8 and padded/truncated to 32 bytes.
   * If omitted, defaults to 32 zero bytes.
   *
   * @see https://docs.anza.xyz/proposals/off-chain-message-signing
   */
  appDomain?: string;
};
