export const ZCASH_CLA = 0xe0 as const;

export const P1 = {
  FIRST: 0x00,
  NEXT: 0x80,
  CHANGE_PATH: 0xff,
} as const;

export const P2 = {
  DEFAULT: 0x00,
  SAPLING: 0x05,
  HASH_INPUT_CONTINUE: 0x80,
} as const;

/**
 * PCZT (Partially Constructed Zcash Transaction) APDU framing.
 *
 * Source of truth: `LedgerHQ/app-zcash` (branch `develop`) `src/consts.rs`,
 * `docs/APDU.md` and `docs/PCZT_APDU.md`. Kept separate from the legacy
 * transparent P1/P2 above so the DMK-01 transparent path is untouched.
 */

/** PCZT instruction opcodes (`INS_PCZT_*`). */
export const PCZT_INS = {
  /** Resets the tx context and opens a new PCZT payload. Sent exactly once. */
  HEADER: 0x52,
  /** Streams the transparent input bundle (always sent, count 0 when empty). */
  TRANSPARENT_INPUT: 0x53,
  /** Streams the transparent output bundle (always sent, count 0 when empty). */
  TRANSPARENT_OUTPUT: 0x54,
  /** Signs one transparent input. P2 = input index; DER sig + sighash byte. */
  SIGN_TRANSPARENT: 0x55,
  /** Streams the Orchard action bundle (always sent, count 0 when empty). */
  ORCHARD_ACTION: 0x56,
  /** Signs one Orchard action. P2 = action index; returns spendAuthSig[64]. */
  SIGN_ORCHARD: 0x57,
} as const;

/** P1 packet-sequence framing for a single multi-packet PCZT bundle command. */
export const PCZT_P1 = {
  /** First (or only) APDU packet of the command. */
  FIRST: 0x00,
  /** Continuation APDU packet. */
  NEXT: 0x80,
  /** Last APDU packet of the command. */
  LAST: 0x01,
} as const;

/** P2 framing for PCZT bundle commands. */
export const PCZT_P2 = {
  /** More PCZT bundle commands may still follow. */
  CONTINUE: 0x00,
  /**
   * Final PCZT data packet — valid only on the last packet of
   * `ORCHARD_ACTION`. Signing commands are accepted only after this marker.
   */
  FINISHED: 0x01,
} as const;

/** Maximum APDU `data` payload for one PCZT packet (255 bytes). */
export const PCZT_MAX_PACKET_SIZE = 255 as const;
