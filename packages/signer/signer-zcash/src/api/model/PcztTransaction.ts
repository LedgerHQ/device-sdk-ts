/**
 * Structured PCZT (Partially Constructed Zcash Transaction) input for
 * Orchard shielded signing — DMK-02.
 *
 * The shapes mirror, field-for-field, the compact PCZT subset the device
 * parses (see `LedgerHQ/app-zcash` `docs/PCZT_APDU.md`, branch `develop`).
 * The host (zcash-utils) builds the PCZT and hands these structures to the
 * signer, which serializes them into the `PCZT_*` APDU stream. All multi-byte
 * integer fields are encoded little-endian on the wire, except derivation-path
 * components, which use the standard big-endian `Bip32Path` encoding.
 */

/** PCZT header `common::Global` fields, sent once in `PCZT_HEADER`. */
export type PcztGlobal = {
  /** Transaction version (V5 = 5). */
  txVersion: number;
  versionGroupId: number;
  consensusBranchId: number;
  /** `fallback_lock_time Option<u32>`; `null` encodes the absent tag. */
  fallbackLockTime: number | null;
  expiryHeight: number;
  /** BIP44 coin type (133 mainnet, 1 testnet). */
  coinType: number;
  txModifiable: number;
};

/** A `bip32_derivation` entry for a transparent input/output. */
export type PcztBip32Derivation = {
  signingPath: string;
  /** Compressed secp256k1 public key, 33 bytes. */
  pubkey: Uint8Array;
  /** ZIP-32 seed fingerprint, 32 bytes. Defaults to 32 zero bytes if omitted. */
  seedFingerprint?: Uint8Array;
};

/** A single `transparent::Input`. */
export type PcztTransparentInput = {
  /** Previous output txid, 32 bytes. */
  prevoutTxid: Uint8Array;
  prevoutIndex: number;
  /** `sequence Option<u32>`; `null` encodes the absent tag. */
  sequence: number | null;
  /** Input value in zatoshis. */
  value: bigint;
  scriptPubKey: Uint8Array;
  /** Must be `SIGHASH_ALL` (`0x01`). */
  sighashType: number;
  derivation: PcztBip32Derivation;
};

/** A single `transparent::Output`. */
export type PcztTransparentOutput = {
  /** Output value in zatoshis. */
  value: bigint;
  scriptPubKey: Uint8Array;
  /** Optional `bip32_derivation` (entry count `0` or `1`). */
  derivation?: PcztBip32Derivation | null;
};

/** A single `orchard::Action` (spend + output halves). */
export type PcztOrchardAction = {
  /** Value commitment, 32 bytes. */
  cvNet: Uint8Array;
  /** Spend nullifier, 32 bytes. */
  nullifier: Uint8Array;
  /** Randomized verification key, 32 bytes. */
  rk: Uint8Array;
  /** Raw Orchard payment address of the spent note, 43 bytes. */
  spendRecipient: Uint8Array;
  /** Spent-note value in zatoshis. */
  spendValue: bigint;
  /** Spend rho (ρ), 32 bytes. */
  spendRho: Uint8Array;
  /** Spend rseed, 32 bytes. */
  spendRseed: Uint8Array;
  /**
   * Spend-authorization randomizer (Pallas scalar), 32 bytes. Host-supplied:
   * carried to the device, never returned.
   */
  alpha: Uint8Array;
  /** ZIP-32 derivation path of the signing key. */
  signingPath: string;
  /** ZIP-32 seed fingerprint, 32 bytes. Defaults to 32 zero bytes if omitted. */
  seedFingerprint?: Uint8Array;
  /** Note commitment x-coordinate, 32 bytes. */
  cmx: Uint8Array;
  /** Ephemeral key, 32 bytes. */
  ephemeralKey: Uint8Array;
  encCiphertext: Uint8Array;
  outCiphertext: Uint8Array;
  /** Raw Orchard payment address of the output note, 43 bytes. */
  recipient: Uint8Array;
  /** Output-note value in zatoshis. */
  value: bigint;
  /** Output rseed, 32 bytes. */
  rseed: Uint8Array;
  /** Randomized commitment value, 32 bytes (required by the device). */
  rcv: Uint8Array;
};

/** The Orchard action bundle plus its trailer. */
export type PcztOrchardBundle = {
  actions: PcztOrchardAction[];
  flags: number;
  /** Net value balance in zatoshis (signed). */
  valueBalance: bigint;
  /** Orchard commitment-tree anchor, 32 bytes. */
  anchor: Uint8Array;
};

/**
 * Full structured PCZT to sign. The transparent sections are always streamed
 * (count `0` when empty); `orchardBundle` may be `null`, treated as an empty
 * Orchard bundle.
 */
export type PcztTransaction = {
  global: PcztGlobal;
  transparentInputs: PcztTransparentInput[];
  transparentOutputs: PcztTransparentOutput[];
  orchardBundle: PcztOrchardBundle | null;
};
