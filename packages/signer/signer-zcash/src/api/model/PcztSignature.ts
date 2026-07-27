/**
 * Result types for PCZT (Orchard shielded) signing.
 *
 * These are intentionally distinct from the legacy transparent/ECDSA
 * {@link Signature} (`{ r, s, v }`): the Orchard signature is a RedPallas
 * spend-authorization signature returned by the device, incompatible with the
 * `{ r, s, v }` shape, so the two never mix.
 */

/**
 * Per-Orchard-action signature returned by the device.
 *
 * The device returns the RedPallas `spendAuthSig` only; `alpha` is a
 * host-supplied PCZT field carried *to* the device and is never returned.
 */
export type OrchardActionSignature = {
  /** RedPallas spend-authorization signature, 64 bytes. */
  spendAuthSig: Uint8Array;
};

/**
 * Result of {@link SignerZcash.signPcztTransaction}.
 *
 * No `bindingSig`: the binding signature is computed host-side (zcash-utils)
 * from `bsk = Σ rcv` and never involves the device.
 */
export type SignPcztTransactionResult = {
  /**
   * One `spendAuthSig` per Orchard action the device signs — i.e. per real
   * spend, in ascending action-index order. Dummy padding spends
   * (`spendValue === 0n`) are self-signed host-side by the PCZT IoFinalizer
   * and are omitted here, so the
   * count matches the finalizer's unsigned-action count.
   */
  orchard: OrchardActionSignature[];
  /**
   * One signature per transparent input, in input order. Each entry is the
   * raw device response for `INS_PCZT_SIGN_TRANSPARENT`: the DER-encoded
   * secp256k1 signature followed by a single `sighash_type` byte (`0x01`,
   * `SIGHASH_ALL`).
   */
  transparentInputSigs: Uint8Array[];
};
