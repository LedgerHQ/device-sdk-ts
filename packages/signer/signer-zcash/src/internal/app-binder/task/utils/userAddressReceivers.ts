import { InvalidArgumentError } from "@ledgerhq/device-management-kit";

import {
  PCZT_RECEIVER_TYPECODE,
  type PcztTransaction,
  type PcztUserAddressReceiver,
} from "@api/model/PcztTransaction";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";

type Pool = "transparent" | "orchard" | "ironwood";

/** Receiver length by typecode. */
const RECEIVER_LENGTH: Record<number, number> = {
  [PCZT_RECEIVER_TYPECODE.P2PKH]: 20,
  [PCZT_RECEIVER_TYPECODE.P2SH]: 20,
  [PCZT_RECEIVER_TYPECODE.SAPLING]: 43,
  [PCZT_RECEIVER_TYPECODE.ORCHARD]: 43,
};

const SHIELDED_ALLOWED: readonly number[] = [
  PCZT_RECEIVER_TYPECODE.P2PKH,
  PCZT_RECEIVER_TYPECODE.P2SH,
  PCZT_RECEIVER_TYPECODE.SAPLING,
];

const TRANSPARENT_ALLOWED: readonly number[] = [
  PCZT_RECEIVER_TYPECODE.SAPLING,
  PCZT_RECEIVER_TYPECODE.ORCHARD,
];

/** Encoded `tag 0x02` values, aligned with the outputs of each pool. */
export type ResolvedUserAddressReceivers = {
  transparent: (Uint8Array | undefined)[];
  orchard: (Uint8Array | undefined)[];
  ironwood: (Uint8Array | undefined)[];
  /** Number of outputs that carry a value. */
  count: number;
};

const encode = (
  pool: Pool,
  index: number,
  receivers: PcztUserAddressReceiver[],
): Uint8Array | InvalidArgumentError => {
  const fail = (rule: string) =>
    new InvalidArgumentError(
      `Invalid user address receivers on ${pool} output #${index}: ${rule}`,
    );
  const allowed =
    pool === "transparent" ? TRANSPARENT_ALLOWED : SHIELDED_ALLOWED;

  if (pool === "transparent" && receivers.length === 0) {
    return fail("the list must not be empty");
  }

  const parts: Uint8Array[] = [];
  let previous = -1;
  let hasP2pkh = false;
  let hasP2sh = false;
  for (const { typecode, receiver } of receivers) {
    if (!allowed.includes(typecode)) {
      return fail(`typecode 0x${typecode.toString(16)} is not allowed`);
    }
    if (receiver.length !== RECEIVER_LENGTH[typecode]) {
      return fail(
        `typecode 0x${typecode.toString(16)} requires ${RECEIVER_LENGTH[typecode]} bytes, got ${receiver.length}`,
      );
    }
    if (typecode <= previous) {
      return fail("typecodes must be in strictly ascending order");
    }
    previous = typecode;
    hasP2pkh ||= typecode === PCZT_RECEIVER_TYPECODE.P2PKH;
    hasP2sh ||= typecode === PCZT_RECEIVER_TYPECODE.P2SH;
    parts.push(Uint8Array.of(typecode), receiver);
  }
  if (hasP2pkh && hasP2sh) {
    return fail("P2PKH and P2SH cannot both be present");
  }
  return concatUint8Arrays(...parts);
};

/**
 * Validates and encodes every `userAddressReceivers` list of a transaction,
 * before any APDU is sent. `null`, `undefined` and absent all give no value.
 */
export const resolveUserAddressReceivers = (
  transaction: PcztTransaction,
): ResolvedUserAddressReceivers | InvalidArgumentError => {
  let count = 0;

  const resolvePool = <
    T extends { userAddressReceivers?: PcztUserAddressReceiver[] | null },
  >(
    pool: Pool,
    outputs: T[],
  ): (Uint8Array | undefined)[] | InvalidArgumentError => {
    const values: (Uint8Array | undefined)[] = [];
    for (let i = 0; i < outputs.length; i += 1) {
      const output = outputs[i]!;
      const receivers = output.userAddressReceivers;
      if (receivers === null || receivers === undefined) {
        values.push(undefined);
        continue;
      }
      if (
        pool === "transparent" &&
        (output as { derivation?: unknown }).derivation
      ) {
        return new InvalidArgumentError(
          `Invalid user address receivers on transparent output #${i}: not allowed on a change output`,
        );
      }
      const encoded = encode(pool, i, receivers);
      if (encoded instanceof InvalidArgumentError) {
        return encoded;
      }
      values.push(encoded);
      count += 1;
    }
    return values;
  };

  const transparent = resolvePool(
    "transparent",
    transaction.transparentOutputs,
  );
  if (transparent instanceof InvalidArgumentError) return transparent;
  const orchard = resolvePool(
    "orchard",
    transaction.orchardBundle?.actions ?? [],
  );
  if (orchard instanceof InvalidArgumentError) return orchard;
  const ironwood = resolvePool(
    "ironwood",
    transaction.ironwoodBundle?.actions ?? [],
  );
  if (ironwood instanceof InvalidArgumentError) return ironwood;

  return { transparent, orchard, ironwood, count };
};
