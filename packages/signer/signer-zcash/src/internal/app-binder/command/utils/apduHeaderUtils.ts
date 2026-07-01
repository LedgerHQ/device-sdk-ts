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
 * transparent P1/P2 above so the legacy transparent path is untouched.
 */

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
