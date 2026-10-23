import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import {
  type SignedTransactionInput,
  type TransactionSerializer,
} from "@internal/app-binder/task/format/TransactionSerializer";
import { createVarint } from "@internal/app-binder/task/utils/legacyTransactionUtils";

const SAPLING_VERSION = 0x80000004;
const SAPLING_VERSION_GROUP_ID = Uint8Array.of(0x85, 0x20, 0x2f, 0x89);
// An empty Sapling part: the value balance, then no spends, outputs or
// joinsplits.
const EMPTY_SAPLING_PART = new Uint8Array(11);
const EMPTY_EXPIRY_HEIGHT = new Uint8Array(4);

/**
 * The `sapling` format, the v4 transactions of Komodo, as hw-app-btc's
 * `createTransaction` serializes them with "sapling" and an expiry height.
 */
@injectable()
export class SaplingTransactionSerializer implements TransactionSerializer {
  serializeHeader(inputCount: number): Uint8Array {
    return new ByteArrayBuilder()
      .add32BitUIntToData(SAPLING_VERSION, false)
      .addBufferToData(SAPLING_VERSION_GROUP_ID)
      .addBufferToData(createVarint(inputCount))
      .build();
  }

  serializeSignedTransaction({
    inputs,
    outputScript,
    lockTime,
  }: {
    inputs: SignedTransactionInput[];
    outputScript: Uint8Array;
    lockTime: number;
  }): Uint8Array {
    const builder = new ByteArrayBuilder().addBufferToData(
      this.serializeHeader(inputs.length),
    );

    inputs.forEach(({ prevout, script, sequence }) => {
      builder
        .addBufferToData(prevout)
        .addBufferToData(createVarint(script.length))
        .addBufferToData(script)
        .addBufferToData(sequence);
    });

    return builder
      .addBufferToData(outputScript)
      .add32BitUIntToData(lockTime, false)
      .addBufferToData(EMPTY_EXPIRY_HEIGHT)
      .addBufferToData(EMPTY_SAPLING_PART)
      .build();
  }
}
