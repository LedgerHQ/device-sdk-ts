import {
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

export function hexToBytes(hex: string): Uint8Array {
  return hexaStringToBuffer(hex) ?? new Uint8Array();
}

export function bytesToHex(bytes: Uint8Array): string {
  return bufferToHexaString(bytes).slice(2); // Remove the "0x" prefix
}
