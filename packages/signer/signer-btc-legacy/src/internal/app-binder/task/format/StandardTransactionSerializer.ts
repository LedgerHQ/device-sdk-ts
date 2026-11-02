import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import {
  type SignedTransactionInput,
  type TransactionSerializer,
} from "@internal/app-binder/task/format/TransactionSerializer";
import { createVarint } from "@internal/app-binder/task/utils/legacyTransactionUtils";

// hw-app-btc's default for a transaction without an expiry height.
const TRANSACTION_VERSION = 1;
const SEGWIT_MARKER_AND_FLAG = Uint8Array.of(0x00, 0x01);

/**
 * The `standard` format, as hw-app-btc's `createTransaction` serializes a
 * transaction.
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
    witnesses,
  }: {
    inputs: SignedTransactionInput[];
    outputScript: Uint8Array;
    lockTime: number;
    witnesses?: Uint8Array[];
  }): Uint8Array {
    const builder = new ByteArrayBuilder().add32BitUIntToData(
      TRANSACTION_VERSION,
      false,
    );
    if (witnesses !== undefined) {
      builder.addBufferToData(SEGWIT_MARKER_AND_FLAG);
    }
    builder.addBufferToData(createVarint(inputs.length));

    inputs.forEach(({ prevout, script, sequence }) => {
      builder
        .addBufferToData(prevout)
        .addBufferToData(createVarint(script.length))
        .addBufferToData(script)
        .addBufferToData(sequence);
    });

    builder.addBufferToData(outputScript);
    witnesses?.forEach((witness) => builder.addBufferToData(witness));
    return builder.add32BitUIntToData(lockTime, false).build();
  }
}
