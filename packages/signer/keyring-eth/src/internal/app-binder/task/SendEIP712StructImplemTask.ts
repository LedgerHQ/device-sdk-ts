import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  InternalApi,
} from "@ledgerhq/device-sdk-core";

import {
  SendEIP712StructImplemCommand,
  StructImplemType,
} from "@internal/app-binder/command/SendEIP712StructImplemCommand";

export type SendEIP712StructImplemTaskArgs =
  | {
      type: StructImplemType.ROOT;
      value: string;
    }
  | {
      type: StructImplemType.ARRAY;
      value: number;
    }
  | {
      type: StructImplemType.FIELD;
      value: Uint8Array;
    };

export class SendEIP712StructImplemTask {
  constructor(
    private api: InternalApi,
    private args: SendEIP712StructImplemTaskArgs,
  ) {}

  async run(): Promise<void> {
    // No particular operation to perform on root and array implementations.
    if (this.args.type !== StructImplemType.FIELD) {
      return this.api.sendCommand(new SendEIP712StructImplemCommand(this.args));
    }

    // If the value is a field, we should prepend its size, and chunk it if necessary.

    // Prepend the length to the array, in uint16 big endian encoding
    const buffer = new ByteArrayBuilder(this.args.value.length + 2)
      .add16BitUIntToData(this.args.value.length)
      .addBufferToData(this.args.value)
      .build();

    // Split the buffer into chunks if necessary
    for (let i = 0; i < buffer.length; i += APDU_MAX_PAYLOAD) {
      await this.api.sendCommand(
        new SendEIP712StructImplemCommand({
          type: StructImplemType.FIELD,
          value: {
            data: buffer.slice(i, i + APDU_MAX_PAYLOAD),
            isLastChunk: i >= buffer.length - APDU_MAX_PAYLOAD,
          },
        }),
      );
    }
  }
}
