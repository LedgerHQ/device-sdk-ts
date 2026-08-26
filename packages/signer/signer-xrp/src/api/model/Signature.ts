/**
 * A transaction signature as the XRP application returns it: DER-encoded for
 * secp256k1. Its length varies, so it is kept as raw bytes rather than being
 * split into `{ r, s, v }` the way the Ethereum signer does.
 */
export type Signature = Uint8Array;
