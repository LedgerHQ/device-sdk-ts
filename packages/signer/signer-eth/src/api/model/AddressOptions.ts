export type AddressOptions = {
  checkOnDevice?: boolean;
  returnChainCode?: boolean;
  skipOpenApp?: boolean;
  /** Optional chain ID for address derivation (e.g. 1 for Ethereum mainnet). When omitted, defaults to 1. */
  chainId?: number;
};
