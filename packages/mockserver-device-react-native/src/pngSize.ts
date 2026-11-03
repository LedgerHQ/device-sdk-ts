import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import { type Size } from "@ledgerhq/device-mockserver-react-core";

const BASE64_DATA_URI = /^data:[^;,]*;base64,/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The signature, then the IHDR chunk's length, type, width and height. */
const HEADER_BYTES = 24;

/**
 * A PNG data URI's size in pixels, read from its header, or null for anything
 * else. Image's onLoad cannot tell it on iOS, which decodes at the screen's
 * scale and reports points: a 400 pixel wide frame comes back 133 wide.
 */
export const pngSize = (dataUri: string): Size | null => {
  const prefix = BASE64_DATA_URI.exec(dataUri)?.[0];
  if (!prefix) return null;
  // Four base64 characters per three bytes.
  const bytes = base64StringToBuffer(
    dataUri.slice(prefix.length, prefix.length + (HEADER_BYTES / 3) * 4),
  );
  if (
    !bytes ||
    bytes.length < HEADER_BYTES ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width && height ? { width, height } : null;
};
