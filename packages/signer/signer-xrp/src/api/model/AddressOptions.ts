export type AddressOptions = {
  /** Display the address on the device and wait for the user to confirm it. */
  checkOnDevice?: boolean;
  /** Ask the app to return the BIP32 chain code alongside the address. */
  returnChainCode?: boolean;
  skipOpenApp?: boolean;
};
