import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;

const OP_PUSHLENGTH_MAX = 0x4e;
const OP_PUSHDATA1_MAX = 0xff;
const OP_PUSHDATA2_MAX = 0xffff;

/**
 * Writes a script push operation to buf, which looks different
 * depending on the size of the data. See
 * https://en.bitcoin.it/wiki/Script#Constants
 *
 * @param {Uint8Array} data - The input data to be encoded.
 * @return {Uint8Array} - The encoded script operation data as a byte array.
 */
export function encodeScriptOperations(data: Uint8Array) {
  const buf = new ByteArrayBuilder();
  if (data.length <= OP_PUSHLENGTH_MAX) {
    buf.add8BitUIntToData(data.length);
  } else if (data.length <= OP_PUSHDATA1_MAX) {
    buf.add8BitUIntToData(OP_PUSHDATA1);
    buf.add8BitUIntToData(data.length);
  } else if (data.length <= OP_PUSHDATA2_MAX) {
    buf.add8BitUIntToData(OP_PUSHDATA2);
    const b = new ByteArrayBuilder()
      .add16BitUIntToData(data.length, false)
      .build();
    buf.addBufferToData(b);
  }
  buf.addBufferToData(data);
  return buf.build();
}
