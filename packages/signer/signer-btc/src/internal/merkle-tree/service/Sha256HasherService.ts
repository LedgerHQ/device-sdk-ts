import { sha256 } from "@noble/hashes/sha2.js";

import { type HasherService } from "./HasherService";

export class Sha256HasherService implements HasherService {
  hash(buffer: Uint8Array): Uint8Array {
    return sha256(buffer);
  }
}
