import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

import {
  type LegacyTransaction,
  type LegacyTransactionInput,
  type LegacyTransactionOutput,
} from "@api/model/CreateTransactionArg";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";
import { uint32ToBytesLE } from "@internal/utils/numberToBytes";

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
  // https://z.cash/upgrade/nu6.2/
  NU6_2: 3364600,
  NU6_1: 3146400,
  NU6: 2726400,
  NU5: 1687104,
  CANOPY: 1046400,
  HEARTWOOD: 903000,
  BLOSSOM: 653600,
  SAPLING: 419200,
} as const;

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

const copyBytes = (value: Uint8Array): Uint8Array => Uint8Array.from(value);

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

const toInternalInput = (
  input: LegacyTransactionInput,
): InternalTransactionInput => ({
  prevout: copyBytes(input.prevout),
  script: copyBytes(input.script),
  sequence: copyBytes(input.sequence),
  tree: input.tree ? copyBytes(input.tree) : undefined,
});

const toInternalOutput = (
  output: LegacyTransactionOutput,
): InternalTransactionOutput => ({
  amount: copyBytes(output.amount),
  script: copyBytes(output.script),
});

export const toInternalTransaction = (
  transaction: LegacyTransaction,
): InternalTransaction => ({
  version: copyBytes(transaction.version),
  inputs: transaction.inputs.map(toInternalInput),
  outputs: transaction.outputs?.map(toInternalOutput),
  locktime: transaction.locktime ? copyBytes(transaction.locktime) : undefined,
  timestamp: transaction.timestamp
    ? copyBytes(transaction.timestamp)
    : undefined,
  nVersionGroupId: transaction.nVersionGroupId
    ? copyBytes(transaction.nVersionGroupId)
    : undefined,
  nExpiryHeight: transaction.nExpiryHeight
    ? copyBytes(transaction.nExpiryHeight)
    : undefined,
  extraData: transaction.extraData
    ? copyBytes(transaction.extraData)
    : undefined,
  consensusBranchId: transaction.consensusBranchId
    ? copyBytes(transaction.consensusBranchId)
    : undefined,
});

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

export const serializeTransaction = (
  transaction: InternalTransaction,
  timestampOverride?: Uint8Array,
): Uint8Array => {
  let inputBuffer: Uint8Array = new Uint8Array(0);

  transaction.inputs.forEach((input) => {
    inputBuffer = concatUint8Arrays(
      inputBuffer,
      input.prevout,
      createVarint(input.script.length),
      input.script,
      input.sequence,
    );
  });

  const isTxV4 =
    transaction.version.length >= 4 &&
    (readUint32LE(transaction.version, 0) & 0x7fffffff) === 4;

  if (isTxV4) {
    // v4 (Sapling) GET_TRUSTED_INPUT framing expected by the Zcash device app:
    //   version | nVersionGroupId | consensusBranchId | varint(vin) | inputs |
    //   varint(vout) | outputs | <3 shielded routing counts> |
    //   locktime | varint(4 + extraData) | nExpiryHeight | extraData
    // Unlike v5, locktime/nExpiryHeight are NOT in the header — they trail the
    // outputs. Emitting them in the header (v5 layout) shifts the input count
    // onto the locktime byte, so the device reads 0 inputs and rejects the
    // stream with 6a80 (IncorrectData).
    const locktime =
      transaction.locktime && transaction.locktime.byteLength > 0
        ? transaction.locktime
        : new Uint8Array(4);
    const expiry = resolveExpiryHeightBytes(transaction.nExpiryHeight);
    const extraData = transaction.extraData || new Uint8Array(0);

    return concatUint8Arrays(
      transaction.version,
      transaction.nVersionGroupId || new Uint8Array(0),
      transaction.consensusBranchId || new Uint8Array(0),
      createVarint(transaction.inputs.length),
      inputBuffer,
      serializeTransactionOutputs(transaction),
      new Uint8Array(3),
      locktime,
      createVarint(expiry.length + extraData.length),
      expiry,
      extraData,
    );
  }

  let outputBuffer: Uint8Array = serializeTransactionOutputs(transaction);
  if (transaction.outputs && transaction.locktime) {
    outputBuffer = concatUint8Arrays(
      outputBuffer,
      new Uint8Array(3),
      transaction.extraData || new Uint8Array(0),
    );
  }

  const locktime =
    transaction.locktime && transaction.locktime.byteLength > 0
      ? transaction.locktime
      : new Uint8Array(4);
  const expiry = resolveExpiryHeightBytes(transaction.nExpiryHeight);

  return concatUint8Arrays(
    transaction.version,
    timestampOverride ?? transaction.timestamp ?? new Uint8Array(0),
    transaction.nVersionGroupId || new Uint8Array(0),
    transaction.consensusBranchId || new Uint8Array(0),
    locktime,
    expiry,
    createVarint(transaction.inputs.length),
    inputBuffer,
    outputBuffer,
  );
};

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  const prefix = ((publicKey.at(64) ?? 0) & 1) === 0 ? 0x02 : 0x03;
  return concatUint8Arrays(Uint8Array.of(prefix), publicKey.subarray(1, 33));
};

export const hashPublicKey = (buffer: Uint8Array): Uint8Array =>
  ripemd160(sha256(buffer));

/** P2PKH `scriptPubKey` for a transparent Zcash address from a Ledger `GetAddress` pubkey. */
export const buildP2pkhScriptPubKeyFromLedgerZcashPublicKey = (
  ledgerPublicKey: Uint8Array,
): Uint8Array => {
  let compressed: Uint8Array | null;
  if (ledgerPublicKey.length === 65) {
    compressed = compressPublicKey(ledgerPublicKey);
  } else if (ledgerPublicKey.length === 33) {
    compressed = ledgerPublicKey;
  } else {
    compressed = null;
  }
  if (compressed?.length !== 33) {
    throw new Error(
      "Expected 65-byte uncompressed or 33-byte compressed secp256k1 public key",
    );
  }
  const pubHash = hashPublicKey(compressed);
  return concatUint8Arrays(
    Uint8Array.of(OP_DUP, OP_HASH160, HASH_SIZE),
    pubHash,
    Uint8Array.of(OP_EQUALVERIFY, OP_CHECKSIG),
  );
};

export const getZcashBranchId = (
  blockHeight: number | null | undefined,
): Uint8Array => {
  if (
    blockHeight === null ||
    blockHeight === undefined ||
    blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU6_2
  ) {
    // NOTE: null and undefined should default to the latest version
    return uint32ToBytesLE(0x5437f330);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU6_1) {
    return uint32ToBytesLE(0x4dec4df0);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU6) {
    return uint32ToBytesLE(0xc8e71055);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.NU5) {
    return uint32ToBytesLE(0xc2d6d0b4);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.CANOPY) {
    return uint32ToBytesLE(0xe9ff75a6);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.HEARTWOOD) {
    return uint32ToBytesLE(0xf5b9230b);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.BLOSSOM) {
    return uint32ToBytesLE(0x2bb40e60);
  } else if (blockHeight >= ZCASH_ACTIVATION_HEIGHTS.SAPLING) {
    return uint32ToBytesLE(0x76b809bb);
  } else {
    return uint32ToBytesLE(0x5ba81b19);
  }
};

/** Zcash transparent v5 transaction version used with the Zcash Ledger app. */
export const getZcashDefaultTransactionVersion = (): Uint8Array =>
  uint32ToBytesLE(0x80000005);

export const EXPIRY_HEIGHT_BYTE_LENGTH = 4;

/**
 * Zcash SIGN (`0x48`) and v5 transaction serialization require a 4-byte expiry height.
 * Undefined or empty input is normalized to four zero bytes.
 */
export function resolveExpiryHeightBytes(
  expiryHeight?: Uint8Array,
): Uint8Array {
  if (expiryHeight === undefined || expiryHeight.byteLength === 0) {
    return new Uint8Array(EXPIRY_HEIGHT_BYTE_LENGTH);
  }
  if (expiryHeight.byteLength !== EXPIRY_HEIGHT_BYTE_LENGTH) {
    throw new Error(
      `expiryHeight must be ${EXPIRY_HEIGHT_BYTE_LENGTH} bytes (got ${expiryHeight.byteLength})`,
    );
  }
  return copyBytes(expiryHeight);
}
