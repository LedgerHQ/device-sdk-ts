import {
  CHUNK_SIZE,
  SIGN_PERSONAL_MESSAGE_P1,
} from "@internal/app-binder/constants";

import { type TransactionFrame } from "./TransactionSerializer";

const MESSAGE_LENGTH_PREFIX_SIZE = 4;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Frame a personal message into the APDU frames expected by the Tron app's
 * SIGN_PERSONAL_MESSAGE instruction.
 *
 * Mirrors `@ledgerhq/hw-app-trx` `signPersonalMessage`: the message is prefixed
 * with its big-endian 32-bit length, the first frame additionally carries the
 * derivation path, and the payload is split into fixed-size chunks.
 *
 * @param encodedPath the derivation path bytes (length byte + BE32 elements)
 * @param message the raw message bytes
 */
export function serializePersonalMessage(
  encodedPath: Uint8Array,
  message: Uint8Array,
): TransactionFrame[] {
  const prefixed = new Uint8Array(MESSAGE_LENGTH_PREFIX_SIZE + message.length);
  new DataView(prefixed.buffer).setUint32(0, message.length, false);
  prefixed.set(message, MESSAGE_LENGTH_PREFIX_SIZE);

  const frames: TransactionFrame[] = [];
  let offset = 0;

  while (offset < prefixed.length) {
    const isFirst = offset === 0;
    // The first frame must leave room for the derivation path header.
    const maxChunkSize = isFirst ? CHUNK_SIZE - encodedPath.length : CHUNK_SIZE;
    const chunkSize = Math.min(maxChunkSize, prefixed.length - offset);
    const chunk = prefixed.subarray(offset, offset + chunkSize);

    frames.push({
      p1: isFirst
        ? SIGN_PERSONAL_MESSAGE_P1.FIRST
        : SIGN_PERSONAL_MESSAGE_P1.SUBSEQUENT,
      payload: isFirst ? concat(encodedPath, chunk) : chunk,
    });

    offset += chunkSize;
  }

  return frames;
}
