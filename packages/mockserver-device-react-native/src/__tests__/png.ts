import { bufferToBase64String } from "@ledgerhq/device-management-kit";

/** The start of a PNG of that size, as a data URI: its signature and IHDR. */
export const aPngDataUri = (width: number, height: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return `data:image/png;base64,${bufferToBase64String(bytes)}`;
};
