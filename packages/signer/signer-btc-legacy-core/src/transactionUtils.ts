import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

import { concatUint8Arrays } from "./bytes";

export const MAX_SCRIPT_BLOCK = 50;
export const DEFAULT_LOCKTIME = 0;
export const DEFAULT_SEQUENCE = 0xffffffff;
export const SIGHASH_ALL = 0x01;
export const OP_DUP = 0x76;
export const OP_HASH160 = 0xa9;
export const HASH_SIZE = 0x14;
export const OP_EQUALVERIFY = 0x88;
export const OP_CHECKSIG = 0xac;

export type InternalTransactionInput = {
  prevout: Uint8Array;
  script: Uint8Array;
  sequence: Uint8Array;
  tree?: Uint8Array;
};

export type InternalTransactionOutput = {
  amount: Uint8Array;
  script: Uint8Array;
};

export type InternalTransaction = {
  version: Uint8Array;
  inputs: InternalTransactionInput[];
  outputs?: InternalTransactionOutput[];
  locktime?: Uint8Array;
  timestamp?: Uint8Array;
  nVersionGroupId?: Uint8Array;
  nExpiryHeight?: Uint8Array;
  extraData?: Uint8Array;
  consensusBranchId?: Uint8Array;
};

const readUint16LE = (buf: Uint8Array, offset: number): number =>
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint16(
    offset,
    true,
  );

const readUint32LE = (buf: Uint8Array, offset: number): number =>
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(
    offset,
    true,
  );

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

/** Reads a Bitcoin-style varint compatible with {@link createVarint}. */
export const readVarint = (
  buf: Uint8Array,
  offset: number,
): [value: number, nextOffset: number] | null => {
  if (offset >= buf.length) return null;
  const first = buf[offset]!;
  if (first < 0xfd) {
    return [first, offset + 1];
  }
  if (first === 0xfd) {
    if (offset + 3 > buf.length) return null;
    return [readUint16LE(buf, offset + 1), offset + 3];
  }
  if (first === 0xfe) {
    if (offset + 5 > buf.length) return null;
    return [readUint32LE(buf, offset + 1) >>> 0, offset + 5];
  }
  if (first === 0xff) {
    if (offset + 9 > buf.length) return null;
    const lo = readUint32LE(buf, offset + 1);
    const hi = readUint32LE(buf, offset + 5);
    if (hi !== 0) return null;
    return [lo, offset + 9];
  }
  return null;
};

/**
 * Parses output `scriptPubKey`s from `hw-app-btc` createPaymentTransaction
 * `outputScriptHex`: compact output count + (value uint64 LE + compact script
 * length + script)*.
 */
export const parseOutputScriptsFromPaymentOutputBlob = (
  blob: Uint8Array,
): Uint8Array[] | null => {
  if (blob.length === 0) return null;
  const head = readVarint(blob, 0);
  if (head === null || head[0] < 0) return null;
  const outputCount = head[0];
  let offset = head[1];
  const scripts: Uint8Array[] = [];
  for (let i = 0; i < outputCount; i += 1) {
    if (offset + 8 > blob.length) return null;
    offset += 8;
    const sl = readVarint(blob, offset);
    if (sl === null) return null;
    const [scriptLen, scriptStart] = sl;
    if (scriptLen < 0 || scriptStart + scriptLen > blob.length) return null;
    scripts.push(blob.subarray(scriptStart, scriptStart + scriptLen));
    offset = scriptStart + scriptLen;
  }
  if (offset !== blob.length) return null;
  return scripts;
};

export const serializeTransactionOutputs = ({
  outputs,
}: InternalTransaction): Uint8Array => {
  let outputBuffer: Uint8Array = new Uint8Array(0);
  if (outputs) {
    outputBuffer = concatUint8Arrays(
      outputBuffer,
      createVarint(outputs.length),
    );
    outputs.forEach((output) => {
      outputBuffer = concatUint8Arrays(
        outputBuffer,
        output.amount,
        createVarint(output.script.length),
        output.script,
      );
    });
  }
  return outputBuffer;
};

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  const prefix = ((publicKey.at(64) ?? 0) & 1) === 0 ? 0x02 : 0x03;
  return concatUint8Arrays(Uint8Array.of(prefix), publicKey.subarray(1, 33));
};

export const hashPublicKey = (buffer: Uint8Array): Uint8Array =>
  ripemd160(sha256(buffer));
