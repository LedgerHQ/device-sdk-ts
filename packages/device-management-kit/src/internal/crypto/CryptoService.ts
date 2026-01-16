/**
 * Simple crypto service abstraction for hashing operations
 */
export interface CryptoService {
  /**
   * Compute SHA3-256 hash of the input data
   * @param data - The input data to hash
   * @returns The SHA3-256 hash as a Uint8Array (32 bytes)
   */
  sha3_256(data: Uint8Array): Uint8Array;
}
