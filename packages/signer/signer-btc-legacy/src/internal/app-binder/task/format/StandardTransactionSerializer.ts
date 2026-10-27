import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import {
  type SignedTransactionInput,
  type TransactionSerializer,
} from "@internal/app-binder/task/format/TransactionSerializer";
import { createVarint } from "@internal/app-binder/task/utils/legacyTransactionUtils";

// hw-app-btc's default for a transaction without an expiry height.
const TRANSACTION_VERSION = 1;

/**
 * The `standard` format, as hw-app-btc's `createTransaction` serializes a
 * transaction without SegWit inputs.
 */
@injectable()
export class StandardTransactionSerializer implements TransactionSerializer {
  serializeHeader(inputCount: number): Uint8Array {
    return new ByteArrayBuilder()
      .add32BitUIntToData(TRANSACTION_VERSION, false)
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
      .build();
  }
}
