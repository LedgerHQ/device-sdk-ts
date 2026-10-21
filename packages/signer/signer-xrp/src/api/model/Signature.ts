/**
 * A transaction signature as the XRP application returns it: DER-encoded for
 * secp256k1, 64 raw bytes for Ed25519. Its length depends on the curve, so it
 * is kept as raw bytes rather than being split into `{ r, s, v }` the way the
 * Ethereum signer does. Either way, its uppercase hex goes in `TxnSignature`.
 */
export type Signature = Uint8Array;
