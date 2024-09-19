import { hexaStringToBuffer } from "@ledgerhq/device-sdk-core";
import { lib, SHA256 } from "crypto-js";

import { HasherService } from "./HasherService";

export class Sha256HasherService implements HasherService {
  hash(buffer: Uint8Array): Uint8Array {
    const hash = SHA256(lib.WordArray.create(buffer));
    return hexaStringToBuffer(hash.toString())!;
  }
}
