import { getCompiledTransactionMessageDecoder } from "@solana/transaction-messages";
import { Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { injectable } from "inversify";

const PUBLIC_KEY_LENGTH = 32;
const BLOCKHASH_LENGTH = 32;
const HEADER_SIZE = 3;
const MIN_MESSAGE_LENGTH = 4;
const V0_VERSION_MASK = 0x80;
const V1_VERSION_BYTE = 0x81;
// V1 (SIMD-0385): [1 version][3 header][4 configMask][32B LIFETIME TOKEN]…
const V1_BLOCKHASH_OFFSET = 8;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
// SystemInstruction::AdvanceNonceAccount, u32 little-endian discriminator.
const ADVANCE_NONCE_ACCOUNT_DATA = [0x04, 0x00, 0x00, 0x00];
const SHORTVEC_DATA_MASK = 0x7f;
const SHORTVEC_CONTINUATION_BIT = 0x80;
const SHORTVEC_MAX_SHIFT = 35;

/**
 * Bytewise blockhash manipulation for Solana serialized messages.
 *
 * Operates directly on the raw bytes.
 *
 * Solana message layout:
 *   Legacy: [3 header][compact-u16 numAccounts][numAccounts × 32B keys][32B BLOCKHASH]…
 *   V0:     [1 version][3 header][compact-u16 numAccounts][numAccounts × 32B keys][32B BLOCKHASH]…
 *   V1:     [1 version][3 header][4 configMask][32B BLOCKHASH]…
 */
export type BlockhashRefreshBlocker =
  | "durableNonce"
  | "multipleSigners"
  | "undecodable";

@injectable()
export class BlockhashService {
  /**
   * Decode a Solana compact-u16 (shortvec) at the given offset.
   * @returns The decoded value and the number of bytes consumed.
   */
  private decodeShortVec(
    bytes: Uint8Array,
    offset: number,
  ): { length: number; size: number } {
    let value = 0;
    let size = 0;
    let shift = 0;

    while (true) {
      const byte = bytes[offset + size];
      if (byte === undefined) {
        throw new Error("shortvec decode overflow");
      }

      value |= (byte & SHORTVEC_DATA_MASK) << shift;
      size += 1;

      if ((byte & SHORTVEC_CONTINUATION_BIT) === 0) {
        break;
      }

      shift += 7;

      if (shift >= SHORTVEC_MAX_SHIFT) {
        throw new Error("shortvec too long");
      }
    }

    return { length: value, size };
  }

  /**
   * Find the byte offset of the 32-byte `recentBlockhash` field in a
   * serialised Solana message. Handles legacy, v0 and v1 messages by
   * detecting the version prefix (high bit set = versioned).
   *
   * @throws If the message is too short or malformed.
   */
  locateBlockhashOffset(serializedMessage: Uint8Array): number {
    if (serializedMessage.length < MIN_MESSAGE_LENGTH) {
      throw new Error("Message too short to contain a valid header");
    }

    if (serializedMessage[0] === V1_VERSION_BYTE) {
      if (V1_BLOCKHASH_OFFSET + BLOCKHASH_LENGTH > serializedMessage.length) {
        throw new Error(
          "Message too short to contain a blockhash at expected offset",
        );
      }
      return V1_BLOCKHASH_OFFSET;
    }

    let cursor = 0;

    if ((serializedMessage[cursor]! & V0_VERSION_MASK) !== 0) {
      cursor += 1;
    }

    cursor += HEADER_SIZE;

    const { length: numAccounts, size: shortVecSize } = this.decodeShortVec(
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
   * Tell whether replacing the blockhash of a serialised message would
   * invalidate it, and why:
   *   - `durableNonce`: the first instruction is `AdvanceNonceAccount`, so the
   *     blockhash field holds the nonce value, which must not change.
   *   - `multipleSigners`: other signers either already signed the original
   *     message or will sign it after us, so they would not match.
   *   - `undecodable`: the message cannot be parsed, so neither can be ruled out.
   *
   * @returns The reason the blockhash must be kept, or `null` if it can be
   *   refreshed safely.
   */
  getRefreshBlocker(
    serializedMessage: Uint8Array,
  ): BlockhashRefreshBlocker | null {
    let message;
    try {
      message =
        getCompiledTransactionMessageDecoder().decode(serializedMessage);
    } catch {
      return "undecodable";
    }

    const firstInstruction =
      message.version === 1
        ? {
            programIndex: message.instructionHeaders[0]?.programAccountIndex,
            data: message.instructionPayloads[0]?.instructionData,
          }
        : {
            programIndex: message.instructions[0]?.programAddressIndex,
            data: message.instructions[0]?.data,
          };
    const programAddress =
      firstInstruction.programIndex === undefined
        ? undefined
        : message.staticAccounts[firstInstruction.programIndex];
    const data = firstInstruction.data;
    if (
      programAddress === SYSTEM_PROGRAM_ADDRESS &&
      data?.length === ADVANCE_NONCE_ACCOUNT_DATA.length &&
      ADVANCE_NONCE_ACCOUNT_DATA.every((byte, i) => data[i] === byte)
    ) {
      return "durableNonce";
    }

    if (message.header.numSignerAccounts > 1) {
      return "multipleSigners";
    }

    return null;
  }

  /**
   * Return a copy of the serialised message with the `recentBlockhash`
   * field replaced by `newBlockhash`. The original is not mutated.
   *
   * @param newBlockhash - Must be exactly 32 bytes.
   * @throws If `newBlockhash` is not 32 bytes.
   */
  patchBlockhash(
    serializedMessage: Uint8Array,
    newBlockhash: Uint8Array,
  ): Uint8Array {
    if (newBlockhash.length !== BLOCKHASH_LENGTH) {
      throw new Error(
        `newBlockhash must be ${BLOCKHASH_LENGTH} bytes, got ${newBlockhash.length}`,
      );
    }
    const offset = this.locateBlockhashOffset(serializedMessage);
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
  async fetchLatestBlockhash(rpcUrl: string): Promise<Uint8Array> {
    const connection = new Connection(rpcUrl, { commitment: "finalized" });
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    return bs58.decode(blockhash);
  }
}
