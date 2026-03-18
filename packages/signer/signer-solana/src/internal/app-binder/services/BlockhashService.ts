/**
 * Bytewise blockhash manipulation for Solana serialized messages.
 *
 * Operates directly on the raw bytes
 *
 * Solana message layout:
 *   Legacy: [3 header][compact-u16 numAccounts][numAccounts × 32B keys][32B BLOCKHASH]…
 *   V0:     [1 version][3 header][compact-u16 numAccounts][numAccounts × 32B keys][32B BLOCKHASH]…
 */

import { Connection } from "@solana/web3.js";
import bs58 from "bs58";

const PUBLIC_KEY_LENGTH = 32;
const BLOCKHASH_LENGTH = 32;

/**
 * Decode a Solana compact-u16 (shortvec) at the given offset.
 * @returns The decoded value and the number of bytes consumed.
 */
function decodeShortVec(
  bytes: Uint8Array,
  offset: number,
): { length: number; size: number } {
  let value = 0;
  let size = 0;
  let shift = 0;

  for (;;) {
    const byte = bytes[offset + size];
    if (byte === undefined) {
      throw new Error("shortvec decode overflow");
    }

    value |= (byte & 0x7f) << shift;
    size += 1;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;

    if (shift >= 35) {
      throw new Error("shortvec too long");
    }
  }

  return { length: value, size };
}

/**
 * Find the byte offset of the 32-byte `recentBlockhash` field in a
 * serialised Solana message. Handles both legacy and v0 messages by
 * detecting the version prefix (high bit set = v0).
 *
 * @throws If the message is too short or malformed.
 */
export function locateBlockhashOffset(serializedMessage: Uint8Array): number {
  if (serializedMessage.length < 4) {
    throw new Error("Message too short to contain a valid header");
  }

  let cursor = 0;

  // V0 messages start with a version byte that has the high bit set
  if ((serializedMessage[cursor]! & 0x80) !== 0) {
    cursor += 1;
  }

  // Skip 3 fixed header bytes: requiredSigs, readonlySigned, readonlyUnsigned
  cursor += 3;

  const { length: numAccounts, size: shortVecSize } = decodeShortVec(
    serializedMessage,
    cursor,
  );
  cursor += shortVecSize;
  cursor += numAccounts * PUBLIC_KEY_LENGTH;

  if (cursor + BLOCKHASH_LENGTH > serializedMessage.length) {
    throw new Error(
      "Message too short to contain a blockhash at expected offset",
    );
  }

  return cursor;
}

/**
 * Return a copy of the serialised message with the `recentBlockhash`
 * field replaced by 32 zero bytes. The original is not mutated.
 */
export function zeroBlockhash(serializedMessage: Uint8Array): Uint8Array {
  const offset = locateBlockhashOffset(serializedMessage);
  const output = new Uint8Array(serializedMessage);
  output.fill(0, offset, offset + BLOCKHASH_LENGTH);
  return output;
}

/**
 * Return a copy of the serialised message with the `recentBlockhash`
 * field replaced by `newBlockhash`. The original is not mutated.
 *
 * @param newBlockhash - Must be exactly 32 bytes.
 * @throws If `newBlockhash` is not 32 bytes.
 */
export function patchBlockhash(
  serializedMessage: Uint8Array,
  newBlockhash: Uint8Array,
): Uint8Array {
  if (newBlockhash.length !== BLOCKHASH_LENGTH) {
    throw new Error(
      `newBlockhash must be ${BLOCKHASH_LENGTH} bytes, got ${newBlockhash.length}`,
    );
  }
  const offset = locateBlockhashOffset(serializedMessage);
  const output = new Uint8Array(serializedMessage);
  output.set(newBlockhash, offset);
  return output;
}

/**
 * Fetch the latest blockhash from a Solana RPC endpoint using
 * "finalized" commitment.
 *
 * @returns The 32-byte blockhash as a raw `Uint8Array`.
 */
export async function fetchLatestBlockhash(
  rpcUrl: string,
): Promise<Uint8Array> {
  const connection = new Connection(rpcUrl, { commitment: "finalized" });
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  return bs58.decode(blockhash);
}
