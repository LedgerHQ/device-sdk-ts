import { getNextLength } from "@internal/app-binder/command/utils/protobuf";
import {
  CHUNK_SIZE,
  SIGN_TRANSACTION_P1,
} from "@internal/app-binder/constants";

export type TransactionFrame = {
  readonly p1: number;
  readonly payload: Uint8Array;
};

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Frame a raw (already protobuf-serialized) Tron transaction into the ordered
 * list of APDU frames expected by the Tron app's SIGN_TRANSACTION instruction.
 *
 * Mirrors `@ledgerhq/hw-app-trx` `signTransaction`:
 *  - the first frame starts with the encoded derivation path, then transaction
 *    fields are packed onto frames without ever splitting a protobuf field,
 *  - token signatures are appended as their own frames,
 *  - each frame's P1 "start byte" encodes its position and token-slot index.
 *
 * @param encodedPath the derivation path bytes (length byte + BE32 elements)
 * @param rawTransaction the protobuf-serialized `raw_data` bytes
 * @param tokenSignatures decoded token (TRC10) signature payloads, in order
 * @throws if a single protobuf field is larger than {@link CHUNK_SIZE}
 */
export function serializeTransaction(
  encodedPath: Uint8Array,
  rawTransaction: Uint8Array,
  tokenSignatures: Uint8Array[] = [],
): TransactionFrame[] {
  const frames: Uint8Array[] = [];

  // The first frame carries the derivation path header; overflow frames carry
  // transaction bytes only.
  let data = encodedPath;
  let rawTx = rawTransaction;

  while (rawTx.length > 0) {
    const nextLength = getNextLength(rawTx);
    if (nextLength > CHUNK_SIZE) {
      throw new Error("Too many bytes to encode.");
    }

    if (data.length + nextLength > CHUNK_SIZE) {
      frames.push(data);
      data = new Uint8Array(0);
      continue;
    }

    data = concat(data, rawTx.subarray(0, nextLength));
    rawTx = rawTx.subarray(nextLength);
  }
  frames.push(data);

  // Token-signature frames follow the transaction frames.
  const tokenStartIndex = frames.length;
  for (const signature of tokenSignatures) {
    frames.push(signature);
  }

  const startBytes: number[] = [];
  if (frames.length === 1) {
    startBytes.push(SIGN_TRANSACTION_P1.SINGLE);
  } else {
    startBytes.push(SIGN_TRANSACTION_P1.FIRST);

    for (let i = 1; i < frames.length - 1; i += 1) {
      if (i >= tokenStartIndex) {
        startBytes.push(SIGN_TRANSACTION_P1.TOKEN | (i - tokenStartIndex));
      } else {
        startBytes.push(SIGN_TRANSACTION_P1.SUBSEQUENT);
      }
    }

    if (tokenSignatures.length > 0) {
      startBytes.push(
        SIGN_TRANSACTION_P1.TOKEN |
          SIGN_TRANSACTION_P1.TOKEN_LAST_FLAG |
          (tokenSignatures.length - 1),
      );
    } else {
      startBytes.push(SIGN_TRANSACTION_P1.LAST);
    }
  }

  return frames.map((payload, i) => ({ p1: startBytes[i]!, payload }));
}
