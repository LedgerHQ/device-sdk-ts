/**
 * Elliptic curve the XRP application derives the key with and signs with.
 *
 * The same derivation path gives a different key, and so a different XRPL
 * account, on each curve. Use the same curve to get an address and to sign for
 * it: a transaction signed with the other curve is rejected by the network.
 */
export enum Curve {
  /** ECDSA on secp256k1, the default. Signatures are DER-encoded. */
  Secp256k1 = "secp256k1",
  /**
   * EdDSA on Ed25519. Public keys start with `ED`, signatures are 64 raw
   * bytes.
   *
   * Getting an address requires XRP app 2.8.0 or later: older versions answer
   * `6f88`. Signing works on older versions too.
   */
  Ed25519 = "ed25519",
}
