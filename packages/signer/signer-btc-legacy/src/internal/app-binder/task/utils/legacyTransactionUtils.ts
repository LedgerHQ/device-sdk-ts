import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

// Largest piece of a script the apps take in one APDU.
const MAX_SCRIPT_BLOCK = 50;

export const DEFAULT_LOCKTIME = 0;
export const DEFAULT_SEQUENCE = 0xffffffff;
export const SIGHASH_ALL = 0x01;

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  const prefix = ((publicKey.at(64) ?? 0) & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(publicKey.subarray(1, 33), 1);
  return compressed;
};

export const hashPublicKey = (buffer: Uint8Array): Uint8Array =>
  ripemd160(sha256(buffer));

// The script code a SegWit input signs, and the program of its output.
export const p2pkhScript = (publicKeyHash: Uint8Array): Uint8Array =>
  Uint8Array.of(0x76, 0xa9, 0x14, ...publicKeyHash, 0x88, 0xac);

export const p2wpkhScript = (publicKeyHash: Uint8Array): Uint8Array =>
  Uint8Array.of(0x00, 0x14, ...publicKeyHash);

export const createVarint = (value: number): Uint8Array => {
  if (value < 0xfd) {
    return Uint8Array.of(value);
  }

  if (value <= 0xffff) {
    return Uint8Array.of(0xfd, value & 0xff, (value >> 8) & 0xff);
  }

  return Uint8Array.of(
    0xfe,
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  );
};

/**
 * Splits a script into blocks the apps take in one APDU, the sequence appended
 * to the last one. An empty script still sends its sequence.
 */
export const splitScriptBlocks = (
  script: Uint8Array,
  sequence: Uint8Array,
): Uint8Array[] => {
  if (script.length === 0) {
    return [sequence];
  }

  const blocks: Uint8Array[] = [];
  for (let offset = 0; offset < script.length; offset += MAX_SCRIPT_BLOCK) {
    const block = script.subarray(offset, offset + MAX_SCRIPT_BLOCK);
    if (offset + MAX_SCRIPT_BLOCK < script.length) {
      blocks.push(block);
    } else {
      const last = new Uint8Array(block.length + sequence.length);
      last.set(block);
      last.set(sequence, block.length);
      blocks.push(last);
    }
  }
  return blocks;
};

/**
 * Splits the outputs into the chunks of the hash output full command. Unlike
 * an input script, no sequence follows them.
 */
export const splitOutputBlocks = (outputScript: Uint8Array): Uint8Array[] => {
  const blocks: Uint8Array[] = [];
  for (
    let offset = 0;
    offset < outputScript.length;
    offset += MAX_SCRIPT_BLOCK
  ) {
    blocks.push(outputScript.subarray(offset, offset + MAX_SCRIPT_BLOCK));
  }
  return blocks;
};

export const sequenceToBytes = (sequence: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, sequence, true);
  return bytes;
};
