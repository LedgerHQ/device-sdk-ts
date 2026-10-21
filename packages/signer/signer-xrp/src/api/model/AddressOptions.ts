import { type Curve } from "@api/model/Curve";

export type AddressOptions = {
  /** Display the address on the device and wait for the user to confirm it. */
  checkOnDevice?: boolean;
  /** Ask the app to return the BIP32 chain code alongside the address. */
  returnChainCode?: boolean;
  skipOpenApp?: boolean;
  /**
   * Curve to derive the key with. Defaults to `Curve.Secp256k1`.
   *
   * Sign with the same curve: on another curve, the same path is a different
   * account.
   */
  curve?: Curve;
};
