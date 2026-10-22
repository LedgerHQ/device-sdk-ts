import { type Curve } from "@api/model/Curve";

export type TransactionOptions = {
  skipOpenApp?: boolean;
  /**
   * Curve to sign with. Defaults to `Curve.Secp256k1`.
   *
   * Use the curve the address was derived with, which is also the curve of the
   * transaction's `SigningPubKey`. Nothing checks this before signing: with the
   * wrong curve, the device signs with another key and the network rejects the
   * signature.
   */
  curve?: Curve;
  // Add other options as needed
};
