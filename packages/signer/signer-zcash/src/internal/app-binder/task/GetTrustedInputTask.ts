import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetTrustedInputCommand,
  type GetTrustedInputCommandResponse,
} from "@internal/app-binder/command/GetTrustedInputCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const MAX_APDU_DATA_LENGTH = 0xff;
const INDEX_LOOKUP_LENGTH = 4;
const FIRST_CHUNK_MAX_LENGTH = MAX_APDU_DATA_LENGTH - INDEX_LOOKUP_LENGTH;
const NEXT_CHUNK_MAX_LENGTH = MAX_APDU_DATA_LENGTH;
const HEADER_V5_SIZE = 4 * 5;
const HEADER_V4_SIZE = 4 * 3;
const SAPLING_SPEND_SIZE = 32 + 32 + 32;
const SAPLING_OUTPUT_COMPACT_SIZE = 32 + 32 + 52;
const SAPLING_OUTPUT_NON_COMPACT_SIZE = 32 + 16 + 80;
const ORCHARD_ACTION_COMPACT_SIZE = 32 + 32 + 32 + 52;
const ORCHARD_ACTION_NON_COMPACT_SIZE = 32 + 32 + 16 + 80;
const ORCHARD_DIGEST_DATA_SIZE = 1 + 8 + 32;
const MEMO_CHUNK_SIZE = 128;
const MEMO_SIZE = 512;

type GetTrustedInputTaskArgs = {
  transaction: Uint8Array;
  indexLookup?: number;
};

type CompactSize = {
  value: number;
  byteLength: number;
  nextOffset: number;
};

const concatArrays = (...chunks: Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });

  return buffer;
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
): Uint8Array => concatArrays(locktime, new Uint8Array([0x04]), expiry);

const splitTransactionToTrustedInputChunks = (
  transaction: Uint8Array,
): Uint8Array[] => {
  const rawVersion = readUInt32LE(transaction, 0);
  const txVersion = rawVersion & 0x7fffffff;
  const isTxV4 = txVersion === 4;

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
    concatArrays(
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
    chunks.push(transaction.slice(scriptStart, offset));
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
    chunks.push(transaction.slice(valueStart, offset));

    const scriptStart = offset;
    ensureRange(transaction, offset, offset + scriptLength.value);
    offset += scriptLength.value;
    chunks.push(transaction.slice(scriptStart, offset));
  }

  const saplingOrchardStart = offset;
  const saplingSpends = readCompactSize(transaction, offset);
  offset = saplingSpends.nextOffset;
  const saplingOutputs = readCompactSize(transaction, offset);
  offset = saplingOutputs.nextOffset;
  const orchardActions = readCompactSize(transaction, offset);
  offset = orchardActions.nextOffset;
  chunks.push(transaction.slice(saplingOrchardStart, offset));

  if (saplingSpends.value > 0 || saplingOutputs.value > 0) {
    const saplingHeaderStart = offset;
    ensureRange(transaction, offset, offset + 8);
    offset += 8;

    if (saplingSpends.value > 0) {
      ensureRange(transaction, offset, offset + 32);
      offset += 32;
    }
    chunks.push(transaction.slice(saplingHeaderStart, offset));

    for (
      let spendIndex = 0;
      spendIndex < saplingSpends.value;
      spendIndex += 1
    ) {
      const spendStart = offset;
      ensureRange(transaction, offset, offset + SAPLING_SPEND_SIZE);
      offset += SAPLING_SPEND_SIZE;
      chunks.push(transaction.slice(spendStart, offset));
    }

    for (
      let outputIndex = 0;
      outputIndex < saplingOutputs.value;
      outputIndex += 1
    ) {
      const compactStart = offset;
      ensureRange(transaction, offset, offset + SAPLING_OUTPUT_COMPACT_SIZE);
      offset += SAPLING_OUTPUT_COMPACT_SIZE;
      chunks.push(transaction.slice(compactStart, offset));
    }

    let saplingMemoRemaining = saplingOutputs.value * MEMO_SIZE;
    while (saplingMemoRemaining > 0) {
      const memoChunkSize = Math.min(MEMO_CHUNK_SIZE, saplingMemoRemaining);
      ensureRange(transaction, offset, offset + memoChunkSize);
      chunks.push(transaction.slice(offset, offset + memoChunkSize));
      offset += memoChunkSize;
      saplingMemoRemaining -= memoChunkSize;
    }

    for (
      let outputIndex = 0;
      outputIndex < saplingOutputs.value;
      outputIndex += 1
    ) {
      const nonCompactStart = offset;
      ensureRange(
        transaction,
        offset,
        offset + SAPLING_OUTPUT_NON_COMPACT_SIZE,
      );
      offset += SAPLING_OUTPUT_NON_COMPACT_SIZE;
      chunks.push(transaction.slice(nonCompactStart, offset));
    }
  }

  if (orchardActions.value > 0) {
    for (
      let actionIndex = 0;
      actionIndex < orchardActions.value;
      actionIndex += 1
    ) {
      const compactStart = offset;
      ensureRange(transaction, offset, offset + ORCHARD_ACTION_COMPACT_SIZE);
      offset += ORCHARD_ACTION_COMPACT_SIZE;
      chunks.push(transaction.slice(compactStart, offset));
    }

    let orchardMemoRemaining = orchardActions.value * MEMO_SIZE;
    while (orchardMemoRemaining > 0) {
      const memoChunkSize = Math.min(MEMO_CHUNK_SIZE, orchardMemoRemaining);
      ensureRange(transaction, offset, offset + memoChunkSize);
      chunks.push(transaction.slice(offset, offset + memoChunkSize));
      offset += memoChunkSize;
      orchardMemoRemaining -= memoChunkSize;
    }

    for (
      let actionIndex = 0;
      actionIndex < orchardActions.value;
      actionIndex += 1
    ) {
      const nonCompactStart = offset;
      ensureRange(
        transaction,
        offset,
        offset + ORCHARD_ACTION_NON_COMPACT_SIZE,
      );
      offset += ORCHARD_ACTION_NON_COMPACT_SIZE;
      chunks.push(transaction.slice(nonCompactStart, offset));
    }

    const digestStart = offset;
    ensureRange(transaction, offset, offset + ORCHARD_DIGEST_DATA_SIZE);
    offset += ORCHARD_DIGEST_DATA_SIZE;
    chunks.push(transaction.slice(digestStart, offset));
  }

  if (isTxV4) {
    chunks.push(transaction.slice(offset));
    offset = transaction.length;
  } else {
    chunks.push(splitV5ExtraData(locktime, expiry));
  }

  if (offset !== transaction.length) {
    throw new Error(
      `Transaction splitting did not consume all bytes (remaining: ${
        transaction.length - offset
      })`,
    );
  }

  return splitForApduData(chunks);
};

export class GetTrustedInputTask {
  constructor(
    private api: InternalApi,
    private args: GetTrustedInputTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<GetTrustedInputCommandResponse, ZcashErrorCodes>
  > {
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
      return firstResult;
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
        return nextResult;
      }

      lastResponse = nextResult.data;
      chunkIndex += 1;
    }

    return CommandResultFactory({
      data: lastResponse,
    });
  }
}
