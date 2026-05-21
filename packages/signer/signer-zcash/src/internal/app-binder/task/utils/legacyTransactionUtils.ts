import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

import {
  type LegacyTransaction,
  type LegacyTransactionInput,
  type LegacyTransactionOutput,
} from "@api/model/CreateTransactionArg";

export const MAX_SCRIPT_BLOCK = 50;
export const DEFAULT_LOCKTIME = 0;
export const DEFAULT_SEQUENCE = 0xffffffff;
export const SIGHASH_ALL = 0x01;
export const OP_DUP = 0x76;
export const OP_HASH160 = 0xa9;
export const HASH_SIZE = 0x14;
export const OP_EQUALVERIFY = 0x88;
export const OP_CHECKSIG = 0xac;

const ZCASH_ACTIVATION_HEIGHTS = {
  NU6_1: 3146400,
  NU6: 2726400,
  NU5: 1687104,
  CANOPY: 1046400,
  HEARTWOOD: 903000,
  BLOSSOM: 653600,
  SAPLING: 419200,
} as const;

export type InternalTransactionInput = {
  prevout: Buffer;
  script: Buffer;
  sequence: Buffer;
  tree?: Buffer;
};

export type InternalTransactionOutput = {
  amount: Buffer;
  script: Buffer;
};

export type InternalTransaction = {
  version: Buffer;
  inputs: InternalTransactionInput[];
  outputs?: InternalTransactionOutput[];
  locktime?: Buffer;
  timestamp?: Buffer;
  nVersionGroupId?: Buffer;
  nExpiryHeight?: Buffer;
  extraData?: Buffer;
  consensusBranchId?: Buffer;
};

export const toBuffer = (value: Uint8Array): Buffer => Buffer.from(value);

const toInternalInput = (
  input: LegacyTransactionInput,
): InternalTransactionInput => ({
  prevout: toBuffer(input.prevout),
  script: toBuffer(input.script),
  sequence: toBuffer(input.sequence),
  tree: input.tree ? toBuffer(input.tree) : undefined,
});

const toInternalOutput = (
  output: LegacyTransactionOutput,
): InternalTransactionOutput => ({
  amount: toBuffer(output.amount),
  script: toBuffer(output.script),
});

export const toInternalTransaction = (
  transaction: LegacyTransaction,
): InternalTransaction => ({
  version: toBuffer(transaction.version),
  inputs: transaction.inputs.map(toInternalInput),
  outputs: transaction.outputs?.map(toInternalOutput),
  locktime: transaction.locktime ? toBuffer(transaction.locktime) : undefined,
  timestamp: transaction.timestamp
    ? toBuffer(transaction.timestamp)
    : undefined,
  nVersionGroupId: transaction.nVersionGroupId
    ? toBuffer(transaction.nVersionGroupId)
    : undefined,
  nExpiryHeight: transaction.nExpiryHeight
    ? toBuffer(transaction.nExpiryHeight)
    : undefined,
  extraData: transaction.extraData
    ? toBuffer(transaction.extraData)
    : undefined,
  consensusBranchId: transaction.consensusBranchId
    ? toBuffer(transaction.consensusBranchId)
    : undefined,
});

export const createVarint = (value: number): Buffer => {
  if (value < 0xfd) {
    const buffer = Buffer.alloc(1);
    buffer[0] = value;
    return buffer;
  }

  if (value <= 0xffff) {
    const buffer = Buffer.alloc(3);
    buffer[0] = 0xfd;
    buffer[1] = value & 0xff;
    buffer[2] = (value >> 8) & 0xff;
    return buffer;
  }

  const buffer = Buffer.alloc(5);
  buffer[0] = 0xfe;
  buffer[1] = value & 0xff;
  buffer[2] = (value >> 8) & 0xff;
  buffer[3] = (value >> 16) & 0xff;
  buffer[4] = (value >> 24) & 0xff;
  return buffer;
};

/** Reads a Bitcoin-style varint compatible with {@link createVarint}. */
export const readVarint = (
  buf: Buffer,
  offset: number,
): [value: number, nextOffset: number] | null => {
  if (offset >= buf.length) return null;
  const first = buf[offset]!;
  if (first < 0xfd) {
    return [first, offset + 1];
  }
  if (first === 0xfd) {
    if (offset + 3 > buf.length) return null;
    return [buf.readUInt16LE(offset + 1), offset + 3];
  }
  if (first === 0xfe) {
    if (offset + 5 > buf.length) return null;
    return [buf.readUInt32LE(offset + 1) >>> 0, offset + 5];
  }
  if (first === 0xff) {
    if (offset + 9 > buf.length) return null;
    const lo = buf.readUInt32LE(offset + 1);
    const hi = buf.readUInt32LE(offset + 5);
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
  blob: Buffer,
): Buffer[] | null => {
  if (blob.length === 0) return null;
  const head = readVarint(blob, 0);
  if (head === null || head[0] < 0) return null;
  const outputCount = head[0];
  let offset = head[1];
  const scripts: Buffer[] = [];
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
}: InternalTransaction): Buffer => {
  let outputBuffer = Buffer.alloc(0);

  if (outputs) {
    outputBuffer = Buffer.concat([outputBuffer, createVarint(outputs.length)]);
    outputs.forEach((output) => {
      outputBuffer = Buffer.concat([
        outputBuffer,
        output.amount,
        createVarint(output.script.length),
        output.script,
      ]);
    });
  }

  return outputBuffer;
};

export const serializeTransaction = (
  transaction: InternalTransaction,
  timestampOverride?: Buffer,
): Buffer => {
  let inputBuffer = Buffer.alloc(0);

  transaction.inputs.forEach((input) => {
    inputBuffer = Buffer.concat([
      inputBuffer,
      input.prevout,
      createVarint(input.script.length),
      input.script,
      input.sequence,
    ]);
  });

  let outputBuffer = serializeTransactionOutputs(transaction);
  if (transaction.outputs && transaction.locktime) {
    outputBuffer = Buffer.concat([
      outputBuffer,
      Buffer.alloc(3, 0),
      transaction.extraData || Buffer.alloc(0),
    ]);
  }

  return Buffer.concat([
    transaction.version,
    timestampOverride ?? transaction.timestamp ?? Buffer.alloc(0),
    transaction.nVersionGroupId || Buffer.alloc(0),
    transaction.consensusBranchId || Buffer.alloc(0),
    transaction.locktime || Buffer.alloc(0),
    transaction.nExpiryHeight || Buffer.alloc(0),
    createVarint(transaction.inputs.length),
    inputBuffer,
    outputBuffer,
  ]);
};

export const compressPublicKey = (publicKey: Buffer): Buffer => {
  const prefix = ((publicKey.at(64) ?? 0) & 1) !== 0 ? 0x03 : 0x02;
  return Buffer.concat([Buffer.from([prefix]), publicKey.subarray(1, 33)]);
};

export const hashPublicKey = (buffer: Buffer): Buffer =>
  Buffer.from(ripemd160(sha256(buffer)));

/** P2PKH `scriptPubKey` for a transparent Zcash address from a Ledger `GetAddress` pubkey. */
export const buildP2pkhScriptPubKeyFromLedgerZcashPublicKey = (
  ledgerPublicKey: Buffer,
): Buffer => {
  const compressed =
    ledgerPublicKey.length === 65
      ? compressPublicKey(ledgerPublicKey)
      : ledgerPublicKey.length === 33
        ? ledgerPublicKey
        : null;
  if (!compressed || compressed.length !== 33) {
    throw new Error(
      "Expected 65-byte uncompressed or 33-byte compressed secp256k1 public key",
    );
  }
  const pubHash = hashPublicKey(compressed);
  return Buffer.concat([
    Buffer.from([OP_DUP, OP_HASH160, HASH_SIZE]),
    pubHash,
    Buffer.from([OP_EQUALVERIFY, OP_CHECKSIG]),
  ]);
};

export const getZcashBranchId = (
  blockHeight: number | null | undefined,
): Buffer => {
  const branchId = Buffer.alloc(4);
  if (
    blockHeight === null ||
    blockHeight === undefined ||
    blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU6_1
  ) {
    branchId.writeUInt32LE(0x4dec4df0, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU6) {
    branchId.writeUInt32LE(0xc8e71055, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU5) {
    branchId.writeUInt32LE(0xc2d6d0b4, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.CANOPY) {
    branchId.writeUInt32LE(0xe9ff75a6, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.HEARTWOOD) {
    branchId.writeUInt32LE(0xf5b9230b, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.BLOSSOM) {
    branchId.writeUInt32LE(0x2bb40e60, 0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.SAPLING) {
    branchId.writeUInt32LE(0x76b809bb, 0);
  } else {
    branchId.writeUInt32LE(0x5ba81b19, 0);
  }
  return branchId;
};

/** Zcash transparent v5 transaction version used with the Zcash Ledger app. */
export const getZcashDefaultTransactionVersion = (): Buffer => {
  const version = Buffer.alloc(4);
  version.writeUInt32LE(0x80000005, 0);
  return version;
};

export const EXPIRY_HEIGHT_BYTE_LENGTH = 4;

/**
 * Zcash SIGN (`0x48`) and v5 transaction serialization require a 4-byte expiry height.
 * Undefined or empty input is normalized to four zero bytes.
 */
export function resolveExpiryHeightBytes(expiryHeight?: Uint8Array): Buffer {
  if (expiryHeight === undefined || expiryHeight.byteLength === 0) {
    return Buffer.alloc(EXPIRY_HEIGHT_BYTE_LENGTH, 0);
  }
  if (expiryHeight.byteLength !== EXPIRY_HEIGHT_BYTE_LENGTH) {
    throw new Error(
      `expiryHeight must be ${EXPIRY_HEIGHT_BYTE_LENGTH} bytes (got ${expiryHeight.byteLength})`,
    );
  }
  return Buffer.from(expiryHeight);
}
