/**
 * A signature as returned by the device: 65 bytes made of a 1-byte
 * MultiSignature discriminant (0x00 for Ed25519) followed by the 64-byte
 * Ed25519 signature.
 *
 * The discriminant is part of the value, so it is already SCALE-compatible
 * with Substrate's `MultiSignature` enum. Consumers that expect a bare
 * 64-byte signature must drop the first byte.
 */
export type Signature = Uint8Array;
