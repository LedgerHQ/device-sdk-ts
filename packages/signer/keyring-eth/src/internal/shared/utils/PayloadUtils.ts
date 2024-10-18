import {
  ByteArrayBuilder,
  HexaStringEncodeError,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

export class PayloadUtils {
  static PAYLOAD_LENGTH_BYTES = 2;

  static getBufferFromPayload(payload: string): Uint8Array {
    const buffer = hexaStringToBuffer(payload);

    if (buffer === null || buffer.length === 0) {
      throw new HexaStringEncodeError("Invalid payload");
    }

    return new ByteArrayBuilder(buffer.length + this.PAYLOAD_LENGTH_BYTES)
      .add16BitUIntToData(buffer.length)
      .addBufferToData(buffer)
      .build();
  }
}
