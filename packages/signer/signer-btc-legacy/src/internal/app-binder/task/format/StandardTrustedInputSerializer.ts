import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
} from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import { type LegacyTransaction } from "@api/model/CreateTransactionArg";
import { type TrustedInputSerializer } from "@internal/app-binder/task/format/TrustedInputSerializer";
import {
  createVarint,
  splitScriptBlocks,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";

/**
 * The `standard` format, as hw-app-btc's `getTrustedInput` streams it: the
 * header, each input, each output, then the lock time.
 */
@injectable()
export class StandardTrustedInputSerializer implements TrustedInputSerializer {
  serialize({
    version,
    inputs,
    outputs,
    locktime,
  }: LegacyTransaction): Uint8Array[] {
    if (outputs === undefined || locktime === undefined) {
      throw new Error(
        "The previous transaction needs its outputs and lock time",
      );
    }

    const chunks: Uint8Array[] = [
      new ByteArrayBuilder()
        .addBufferToData(version)
        .addBufferToData(createVarint(inputs.length))
        .build(),
    ];

    inputs.forEach(({ prevout, script, sequence }) => {
      chunks.push(
        new ByteArrayBuilder()
          .addBufferToData(prevout)
          .addBufferToData(createVarint(script.length))
          .build(),
        ...splitScriptBlocks(script, sequence),
      );
    });

    chunks.push(createVarint(outputs.length));
    outputs.forEach(({ amount, script }) => {
      const output = new ByteArrayBuilder()
        .addBufferToData(amount)
        .addBufferToData(createVarint(script.length))
        .addBufferToData(script)
        .build();
      // Like hw-app-btc, an output is sent in one APDU, never split.
      if (output.length > APDU_MAX_PAYLOAD) {
        throw new Error(
          "An output of the previous transaction does not fit in one APDU",
        );
      }
      chunks.push(output);
    });

    chunks.push(locktime);
    return chunks;
  }
}
