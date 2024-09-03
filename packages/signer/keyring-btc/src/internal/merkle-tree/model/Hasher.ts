import { hexaStringToBuffer } from "@ledgerhq/device-sdk-core";
import * as CryptoJS from "crypto-js";

export type Hasher = (buffer: Uint8Array) => Uint8Array;

export const Sha256Hasher: Hasher = (buffer) => {
  const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(buffer));
  return hexaStringToBuffer(hash.toString())!;
};
