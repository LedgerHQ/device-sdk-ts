import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetTrustedInputCommand,
  type GetTrustedInputCommandResponse,
} from "@internal/app-binder/command/GetTrustedInputCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { createVarint } from "@internal/app-binder/task/utils/legacyTransactionUtils";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";

const MAX_APDU_DATA_LENGTH = 0xff;
const INDEX_LOOKUP_LENGTH = 4;
const FIRST_CHUNK_MAX_LENGTH = MAX_APDU_DATA_LENGTH - INDEX_LOOKUP_LENGTH;
const NEXT_CHUNK_MAX_LENGTH = MAX_APDU_DATA_LENGTH;
const HEADER_V5_SIZE = 4 * 5;
const HEADER_V4_SIZE = 4 * 3;
const HASH_SIZE = 32;
const VALUE_BALANCE_SIZE = 8;
const FLAGS_SIZE = 1;
const SIGNATURE_SIZE = 64;
const SAPLING_PROOF_SIZE = 192;
const ENC_CIPHERTEXT_COMPACT_SIZE = 52;
const ENC_CIPHERTEXT_TAG_SIZE = 16;
const MEMO_SIZE = 512;
const ENC_CIPHERTEXT_SIZE =
  ENC_CIPHERTEXT_COMPACT_SIZE + MEMO_SIZE + ENC_CIPHERTEXT_TAG_SIZE;
const OUT_CIPHERTEXT_SIZE = 80;
const SAPLING_SPEND_SIZE = 3 * HASH_SIZE;
const SAPLING_OUTPUT_SIZE =
  3 * HASH_SIZE + ENC_CIPHERTEXT_SIZE + OUT_CIPHERTEXT_SIZE;
const ORCHARD_ACTION_SIZE =
  5 * HASH_SIZE + ENC_CIPHERTEXT_SIZE + OUT_CIPHERTEXT_SIZE;
const ORCHARD_DIGEST_DATA_SIZE = FLAGS_SIZE + VALUE_BALANCE_SIZE + HASH_SIZE;
const MEMO_CHUNK_SIZE = 128;
const SCRIPT_SIG_SEQUENCE_CHUNK_SIZE = 50;
const TX_VERSION_MASK = 0x7fffffff;
const TX_VERSION_V4 = 4;
const TX_VERSION_V5 = 5;

type GetTrustedInputTaskArgs = {
  transaction: Uint8Array;
  indexLookup?: number;
};
type GetTrustedInputTaskError = CommandErrorResult<ZcashErrorCodes>["error"];
type GetTrustedInputTaskResult = DmkResult<
  GetTrustedInputCommandResponse,
  GetTrustedInputTaskError
>;

type CompactSize = {
  value: number;
  byteLength: number;
  nextOffset: number;
};

const readUInt8 = (buffer: Uint8Array, offset: number): number => {
  ensureRange(buffer, offset, offset + 1);
  return buffer[offset] ?? 0;
};

const readUInt32LE = (buffer: Uint8Array, offset: number): number => {
  ensureRange(buffer, offset, offset + 4);
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  return view.getUint32(offset, true);
};

const readUInt64LEAsNumber = (buffer: Uint8Array, offset: number): number => {
  ensureRange(buffer, offset, offset + 8);
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);

  return high * 2 ** 32 + low;
};

const ensureRange = (buffer: Uint8Array, start: number, end: number): void => {
  if (start < 0 || end < start || end > buffer.length) {
    throw new Error(
      "Malformed transaction while splitting trusted input chunks",
    );
  }
};

const readCompactSize = (buffer: Uint8Array, offset: number): CompactSize => {
  const first = readUInt8(buffer, offset);

  if (first < 0xfd) {
    return {
      value: first,
      byteLength: 1,
      nextOffset: offset + 1,
    };
  }

  if (first === 0xfd) {
    const value =
      readUInt8(buffer, offset + 1) + (readUInt8(buffer, offset + 2) << 8);
    return {
      value,
      byteLength: 3,
      nextOffset: offset + 3,
    };
  }

  if (first === 0xfe) {
    const value = readUInt32LE(buffer, offset + 1);
    return {
      value,
      byteLength: 5,
      nextOffset: offset + 5,
    };
  }

  ensureRange(buffer, offset + 1, offset + 9);
  const value = readUInt64LEAsNumber(buffer, offset + 1);

  if (!Number.isSafeInteger(value)) {
    throw new Error("CompactSize value exceeds JavaScript safe integer range");
  }

  return {
    value,
    byteLength: 9,
    nextOffset: offset + 9,
  };
};

const splitForApduData = (chunks: Uint8Array[]): Uint8Array[] => {
  const nonEmptyChunks = chunks.filter((chunk) => chunk.length > 0);

  if (nonEmptyChunks.length === 0) {
    throw new Error("Cannot send trusted input for an empty transaction");
  }

  const apduChunks: Uint8Array[] = [];
  let firstApdu = true;

  nonEmptyChunks.forEach((chunk) => {
    let offset = 0;

    while (offset < chunk.length) {
      const maxLength = firstApdu
        ? FIRST_CHUNK_MAX_LENGTH
        : NEXT_CHUNK_MAX_LENGTH;
      const end = Math.min(offset + maxLength, chunk.length);
      apduChunks.push(chunk.slice(offset, end));
      offset = end;
      firstApdu = false;
    }
  });

  return apduChunks;
};

const splitV5ExtraData = (
  locktime: Uint8Array,
  expiry: Uint8Array,
): Uint8Array => concatUint8Arrays(locktime, new Uint8Array([0x04]), expiry);

type ShieldedBundles = {
  saplingSpends: Uint8Array[];
  saplingOutputs: Uint8Array[];
  saplingValueBalance: Uint8Array;
  saplingAnchor: Uint8Array;
  orchardActions: Uint8Array[];
  orchardDigestData: Uint8Array;
};

type DigestParts = {
  compact: Uint8Array;
  memo: Uint8Array;
  nonCompact: Uint8Array;
};

const createFieldReader = (buffer: Uint8Array, startOffset: number) => {
  let offset = startOffset;

  return {
    take: (size: number): Uint8Array => {
      ensureRange(buffer, offset, offset + size);
      const bytes = buffer.slice(offset, offset + size);
      offset += size;
      return bytes;
    },
    skip: (size: number): void => {
      ensureRange(buffer, offset, offset + size);
      offset += size;
    },
    takeCount: (): number => {
      const { value, nextOffset } = readCompactSize(buffer, offset);
      offset = nextOffset;
      return value;
    },
  };
};

/**
 * Reads the shielded bundles of a v5 transaction as they are laid out on chain
 * (ZIP-225): each description keeps its own fields together, and the proofs and
 * signatures trail the descriptions. Proofs and signatures are skipped, as they
 * belong to the authorizing data commitment rather than to the txid, but the
 * Sapling ones still have to be stepped over to reach the Orchard action count.
 */
const readShieldedBundles = (
  transaction: Uint8Array,
  offset: number,
): ShieldedBundles => {
  const reader = createFieldReader(transaction, offset);

  const spendCount = reader.takeCount();
  const saplingSpends = Array.from({ length: spendCount }, () =>
    reader.take(SAPLING_SPEND_SIZE),
  );

  const outputCount = reader.takeCount();
  const saplingOutputs = Array.from({ length: outputCount }, () =>
    reader.take(SAPLING_OUTPUT_SIZE),
  );

  let saplingValueBalance: Uint8Array = new Uint8Array();
  let saplingAnchor: Uint8Array = new Uint8Array();

  if (spendCount > 0 || outputCount > 0) {
    saplingValueBalance = reader.take(VALUE_BALANCE_SIZE);
    if (spendCount > 0) {
      saplingAnchor = reader.take(HASH_SIZE);
    }
    reader.skip(
      spendCount * (SAPLING_PROOF_SIZE + SIGNATURE_SIZE) +
        outputCount * SAPLING_PROOF_SIZE +
        SIGNATURE_SIZE,
    );
  }

  const actionCount = reader.takeCount();
  const orchardActions = Array.from({ length: actionCount }, () =>
    reader.take(ORCHARD_ACTION_SIZE),
  );

  return {
    saplingSpends,
    saplingOutputs,
    saplingValueBalance,
    saplingAnchor,
    orchardActions,
    orchardDigestData:
      actionCount > 0
        ? reader.take(ORCHARD_DIGEST_DATA_SIZE)
        : new Uint8Array(),
  };
};

// OutputDescriptionV5 on chain: cv | cmu | ephemeralKey | encCiphertext | outCiphertext
const saplingOutputDigestParts = (output: Uint8Array): DigestParts => {
  const cv = output.subarray(0, HASH_SIZE);
  const cmuAndEphemeralKey = output.subarray(HASH_SIZE, 3 * HASH_SIZE);
  const enc = output.subarray(
    3 * HASH_SIZE,
    3 * HASH_SIZE + ENC_CIPHERTEXT_SIZE,
  );
  const out = output.subarray(3 * HASH_SIZE + ENC_CIPHERTEXT_SIZE);

  return {
    compact: concatUint8Arrays(
      cmuAndEphemeralKey,
      enc.subarray(0, ENC_CIPHERTEXT_COMPACT_SIZE),
    ),
    memo: enc.subarray(
      ENC_CIPHERTEXT_COMPACT_SIZE,
      ENC_CIPHERTEXT_COMPACT_SIZE + MEMO_SIZE,
    ),
    nonCompact: concatUint8Arrays(
      cv,
      enc.subarray(ENC_CIPHERTEXT_COMPACT_SIZE + MEMO_SIZE),
      out,
    ),
  };
};

// OrchardAction on chain: cv | nullifier | rk | cmx | ephemeralKey | encCiphertext | outCiphertext
const orchardActionDigestParts = (action: Uint8Array): DigestParts => {
  const cv = action.subarray(0, HASH_SIZE);
  const nullifier = action.subarray(HASH_SIZE, 2 * HASH_SIZE);
  const rk = action.subarray(2 * HASH_SIZE, 3 * HASH_SIZE);
  const cmxAndEphemeralKey = action.subarray(3 * HASH_SIZE, 5 * HASH_SIZE);
  const enc = action.subarray(
    5 * HASH_SIZE,
    5 * HASH_SIZE + ENC_CIPHERTEXT_SIZE,
  );
  const out = action.subarray(5 * HASH_SIZE + ENC_CIPHERTEXT_SIZE);

  return {
    compact: concatUint8Arrays(
      nullifier,
      cmxAndEphemeralKey,
      enc.subarray(0, ENC_CIPHERTEXT_COMPACT_SIZE),
    ),
    memo: enc.subarray(
      ENC_CIPHERTEXT_COMPACT_SIZE,
      ENC_CIPHERTEXT_COMPACT_SIZE + MEMO_SIZE,
    ),
    nonCompact: concatUint8Arrays(
      cv,
      rk,
      enc.subarray(ENC_CIPHERTEXT_COMPACT_SIZE + MEMO_SIZE),
      out,
    ),
  };
};

const pushMemoChunks = (chunks: Uint8Array[], memos: Uint8Array[]): void => {
  const stream = concatUint8Arrays(...memos);

  for (let offset = 0; offset < stream.length; offset += MEMO_CHUNK_SIZE) {
    chunks.push(stream.subarray(offset, offset + MEMO_CHUNK_SIZE));
  }
};

/**
 * ZIP-244 spreads a shielded description over three digests — compact, memos and
 * non-compact — and the device app hashes each one from its own stream: it takes
 * the compact part of every description, then every memo, then every non-compact
 * part. On chain those fields are interleaved description by description, so they
 * must be regrouped here; the app hashes as bytes arrive and cannot reorder them.
 * Sapling spends are the exception and keep their on-chain layout, since the app
 * reads cv, nullifier and rk individually and routes each to the right digest.
 */
const pushShieldedChunks = (
  chunks: Uint8Array[],
  bundles: ShieldedBundles,
): void => {
  chunks.push(
    concatUint8Arrays(
      createVarint(bundles.saplingSpends.length),
      createVarint(bundles.saplingOutputs.length),
      createVarint(bundles.orchardActions.length),
    ),
  );

  if (bundles.saplingSpends.length > 0 || bundles.saplingOutputs.length > 0) {
    chunks.push(
      concatUint8Arrays(bundles.saplingValueBalance, bundles.saplingAnchor),
    );

    bundles.saplingSpends.forEach((spend) => chunks.push(spend));

    const outputParts = bundles.saplingOutputs.map(saplingOutputDigestParts);
    outputParts.forEach(({ compact }) => chunks.push(compact));
    pushMemoChunks(
      chunks,
      outputParts.map(({ memo }) => memo),
    );
    outputParts.forEach(({ nonCompact }) => chunks.push(nonCompact));
  }

  if (bundles.orchardActions.length > 0) {
    const actionParts = bundles.orchardActions.map(orchardActionDigestParts);
    actionParts.forEach(({ compact }) => chunks.push(compact));
    pushMemoChunks(
      chunks,
      actionParts.map(({ memo }) => memo),
    );
    actionParts.forEach(({ nonCompact }) => chunks.push(nonCompact));
    chunks.push(bundles.orchardDigestData);
  }
};

const splitTransactionToTrustedInputChunks = (
  transaction: Uint8Array,
): Uint8Array[] => {
  const rawVersion = readUInt32LE(transaction, 0);
  const txVersion = rawVersion & TX_VERSION_MASK;
  const isTxV4 = txVersion === TX_VERSION_V4;

  // The device app computes a txid for v4 and v5 only in this flow, and turns
  // anything newer away with "V6 transaction in legacy path". Naming the version
  // here beats streaming, say, a v6 as though its bundles followed ZIP-225.
  if (!isTxV4 && txVersion !== TX_VERSION_V5) {
    throw new Error(
      `Unsupported transaction version ${txVersion} while splitting trusted input chunks`,
    );
  }

  let offset = 0;
  let locktime = new Uint8Array();
  let expiry = new Uint8Array();
  const chunks: Uint8Array[] = [];

  if (isTxV4) {
    offset += HEADER_V4_SIZE;
  } else {
    ensureRange(transaction, HEADER_V4_SIZE, HEADER_V4_SIZE + 8);
    locktime = transaction.slice(HEADER_V4_SIZE, HEADER_V4_SIZE + 4);
    expiry = transaction.slice(HEADER_V4_SIZE + 4, HEADER_V4_SIZE + 8);
    offset += HEADER_V5_SIZE;
  }

  const vin = readCompactSize(transaction, offset);
  offset = vin.nextOffset;
  chunks.push(
    concatUint8Arrays(
      transaction.slice(0, HEADER_V4_SIZE),
      transaction.slice(offset - vin.byteLength, offset),
    ),
  );

  for (let inputIndex = 0; inputIndex < vin.value; inputIndex += 1) {
    const prevoutStart = offset;
    ensureRange(transaction, offset, offset + 36);
    offset += 36;

    const scriptLength = readCompactSize(transaction, offset);
    offset = scriptLength.nextOffset;
    chunks.push(transaction.slice(prevoutStart, offset));

    const scriptStart = offset;
    ensureRange(transaction, offset, offset + scriptLength.value + 4);
    offset += scriptLength.value + 4;
    const scriptSigAndSequence = transaction.slice(scriptStart, offset);
    for (
      let i = 0;
      i < scriptSigAndSequence.length;
      i += SCRIPT_SIG_SEQUENCE_CHUNK_SIZE
    ) {
      chunks.push(
        scriptSigAndSequence.slice(i, i + SCRIPT_SIG_SEQUENCE_CHUNK_SIZE),
      );
    }
  }

  const vout = readCompactSize(transaction, offset);
  offset = vout.nextOffset;
  chunks.push(transaction.slice(offset - vout.byteLength, offset));

  for (let outputIndex = 0; outputIndex < vout.value; outputIndex += 1) {
    const valueStart = offset;
    ensureRange(transaction, offset, offset + 8);
    offset += 8;

    const scriptLength = readCompactSize(transaction, offset);
    offset = scriptLength.nextOffset;

    ensureRange(transaction, offset, offset + scriptLength.value);
    offset += scriptLength.value;
    chunks.push(transaction.slice(valueStart, offset));
  }

  if (isTxV4) {
    // A v4 previous transaction reaches this point already framed the way the
    // device expects — three zeroed shielded counts, then locktime, extra data
    // length and extra data (see `serializeTransaction`), its Sapling fields
    // travelling in that extra data. Its trailing bytes are forwarded as they
    // are, the counts keeping the separate chunk the device app was tested with.
    const spendCount = readCompactSize(transaction, offset);
    const outputCount = readCompactSize(transaction, spendCount.nextOffset);
    const actionCount = readCompactSize(transaction, outputCount.nextOffset);

    chunks.push(transaction.slice(offset, actionCount.nextOffset));
    chunks.push(transaction.slice(actionCount.nextOffset));

    return splitForApduData(chunks);
  }

  pushShieldedChunks(chunks, readShieldedBundles(transaction, offset));
  chunks.push(splitV5ExtraData(locktime, expiry));

  return splitForApduData(chunks);
};

export class GetTrustedInputTask {
  constructor(
    private api: InternalApi,
    private args: GetTrustedInputTaskArgs,
  ) {}

  async run(): Promise<GetTrustedInputTaskResult> {
    const trustedInputIndex = this.args.indexLookup ?? 0;
    const chunks = splitTransactionToTrustedInputChunks(this.args.transaction);

    const firstChunk = chunks[0];
    if (!firstChunk) {
      throw new Error("Unable to prepare first trusted input APDU chunk");
    }

    const firstResult = await this.api.sendCommand(
      new GetTrustedInputCommand({
        transaction: firstChunk,
        indexLookup: trustedInputIndex,
      }),
    );

    if (!isSuccessCommandResult(firstResult)) {
      return DmkResultFactory({
        error: firstResult.error,
      });
    }

    let lastResponse = firstResult.data;
    let chunkIndex = 1;

    while (chunkIndex < chunks.length) {
      const nextChunk = chunks[chunkIndex];
      if (!nextChunk) {
        throw new Error("Unable to prepare trusted input APDU chunk");
      }
      const nextResult = await this.api.sendCommand(
        new GetTrustedInputCommand({ transaction: nextChunk }),
      );

      if (!isSuccessCommandResult(nextResult)) {
        return DmkResultFactory({
          error: nextResult.error,
        });
      }

      lastResponse = nextResult.data;
      chunkIndex += 1;
    }

    return DmkResultFactory({
      data: lastResponse,
    });
  }
}
