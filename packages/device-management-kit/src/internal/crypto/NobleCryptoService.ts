import { sha3_256 } from "@noble/hashes/sha3";

import { type CryptoService } from "./CryptoService";

/**
 * Noble implementation of the crypto service
 */
export class NobleCryptoService implements CryptoService {
  sha3_256(data: Uint8Array): Uint8Array {
    return sha3_256(data);
  }
}
