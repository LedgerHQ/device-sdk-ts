import {
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

export class PayloadUtils {
  private static PAYLOAD_LENGTH_BYTES = 2;

  static getBufferFromPayload(
    payload: string,
    withPayloadLength = true,
  ): Uint8Array | null {
    const buffer = hexaStringToBuffer(payload);

    if (buffer === null || buffer.length === 0) {
      return null;
    }

    if (withPayloadLength) {
      return new ByteArrayBuilder(buffer.length + this.PAYLOAD_LENGTH_BYTES)
        .add16BitUIntToData(buffer.length)
        .addBufferToData(buffer)
        .build();
    }

    return new ByteArrayBuilder(buffer.length).addBufferToData(buffer).build();
  }
}
