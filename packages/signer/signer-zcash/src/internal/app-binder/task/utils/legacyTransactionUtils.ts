import {
  compressPublicKey,
  createVarint,
  DEFAULT_LOCKTIME,
  DEFAULT_SEQUENCE,
  HASH_SIZE,
  hashPublicKey,
  type InternalTransaction,
  type InternalTransactionInput,
  type InternalTransactionOutput,
  MAX_SCRIPT_BLOCK,
  OP_CHECKSIG,
  OP_DUP,
  OP_EQUALVERIFY,
  OP_HASH160,
  parseOutputScriptsFromPaymentOutputBlob,
  readVarint,
  serializeTransactionOutputs,
  SIGHASH_ALL,
} from "@ledgerhq/signer-btc-legacy-core";

import {
  type LegacyTransaction,
  type LegacyTransactionInput,
  type LegacyTransactionOutput,
  type ZcashNetwork,
} from "@api/model/CreateTransactionArg";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";
import { uint32ToBytesLE } from "@internal/utils/numberToBytes";

// Shared with every coin on the legacy protocol.
export {
  compressPublicKey,
  createVarint,
  DEFAULT_LOCKTIME,
  DEFAULT_SEQUENCE,
  HASH_SIZE,
  hashPublicKey,
  type InternalTransaction,
  type InternalTransactionInput,
  type InternalTransactionOutput,
  MAX_SCRIPT_BLOCK,
  OP_CHECKSIG,
  OP_DUP,
  OP_EQUALVERIFY,
  OP_HASH160,
  parseOutputScriptsFromPaymentOutputBlob,
  readVarint,
  serializeTransactionOutputs,
  SIGHASH_ALL,
};

type BranchIdEntry = {
  activationHeight: number;
  branchId: number;
};

// Ordered from the latest network upgrade to the earliest.
const ZCASH_BRANCH_IDS: Record<ZcashNetwork, readonly BranchIdEntry[]> = {
  mainnet: [
    { activationHeight: 3428143, branchId: 0x37a5165b }, // NU6.3
    { activationHeight: 3364600, branchId: 0x5437f330 }, // NU6.2
    { activationHeight: 3146400, branchId: 0x4dec4df0 }, // NU6.1
    { activationHeight: 2726400, branchId: 0xc8e71055 }, // NU6
    { activationHeight: 1687104, branchId: 0xc2d6d0b4 }, // NU5
    { activationHeight: 1046400, branchId: 0xe9ff75a6 }, // Canopy
    { activationHeight: 903000, branchId: 0xf5b9230b }, // Heartwood
    { activationHeight: 653600, branchId: 0x2bb40e60 }, // Blossom
    { activationHeight: 419200, branchId: 0x76b809bb }, // Sapling
  ],
  testnet: [
    { activationHeight: 4465026, branchId: 0x77190ad9 }, // NU7
    { activationHeight: 4134000, branchId: 0x37a5165b }, // NU6.3
    { activationHeight: 4052000, branchId: 0x5437f330 }, // NU6.2
    { activationHeight: 3536500, branchId: 0x4dec4df0 }, // NU6.1
    { activationHeight: 2976000, branchId: 0xc8e71055 }, // NU6
    { activationHeight: 1842420, branchId: 0xc2d6d0b4 }, // NU5
    { activationHeight: 1028500, branchId: 0xe9ff75a6 }, // Canopy
    { activationHeight: 903800, branchId: 0xf5b9230b }, // Heartwood
    { activationHeight: 584000, branchId: 0x2bb40e60 }, // Blossom
    { activationHeight: 280000, branchId: 0x76b809bb }, // Sapling
  ],
};

const OVERWINTER_BRANCH_ID = 0x5ba81b19;

const copyBytes = (value: Uint8Array): Uint8Array => Uint8Array.from(value);

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
  network: ZcashNetwork = "mainnet",
): Uint8Array => {
  const entries = ZCASH_BRANCH_IDS[network];
  if (blockHeight === null || blockHeight === undefined) {
    // No height: the latest upgrade of the network's table, which must be both
    // active on chain and accepted by the device app.
    return uint32ToBytesLE(entries[0]!.branchId);
  }
  const entry = entries.find((e) => blockHeight >= e.activationHeight);
  return uint32ToBytesLE(entry ? entry.branchId : OVERWINTER_BRANCH_ID);
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
