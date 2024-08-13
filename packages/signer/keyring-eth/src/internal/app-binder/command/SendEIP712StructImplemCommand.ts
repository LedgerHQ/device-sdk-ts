// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-send-struct-implementation
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

export enum StructImplemType {
  ROOT = 0x00,
  ARRAY = 0x0f,
  FIELD = 0xff,
}

export type SendEIP712StructImplemCommandArgs =
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
      value: {
        /**
         * The chunk of the data that is ready to send, that is to say, prefixed by its length in two bytes.
         * Eg. 01020304 => [0x00, 0x04, 0x01, 0x02, 0x03, 0x04] where 0x00, 0x04 are the length of the data.
         */
        data: Uint8Array;
        isLastChunk: boolean;
      };
    };

export class SendEIP712StructImplemCommand implements Command<void> {
  constructor(private readonly args: SendEIP712StructImplemCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1c,
      p1:
        this.args.type != StructImplemType.FIELD || this.args.value.isLastChunk
          ? 0x00
          : 0x01,
      p2: this.args.type,
    };
    switch (this.args.type) {
      case StructImplemType.ROOT:
        return new ApduBuilder(apduBuilderArgs)
          .addAsciiStringToData(this.args.value)
          .build();
      case StructImplemType.ARRAY:
        return new ApduBuilder(apduBuilderArgs)
          .add8BitUIntToData(this.args.value)
          .build();
      case StructImplemType.FIELD:
        return new ApduBuilder(apduBuilderArgs)
          .addBufferToData(this.args.value.data)
          .build();
    }
  }

  parseResponse(response: ApduResponse): void {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          response.statusCode,
        )}`,
      );
    }
  }
}
