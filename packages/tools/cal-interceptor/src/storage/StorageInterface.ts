/**
 * Storage interface for storing descriptors and certificates
 * Synchronous storage for browser environments (localStorage, memory, etc.)
 */
export interface StorageInterface {
  /**
   * Get all stored descriptors
   * @returns Map of descriptors keyed by "chainId:address"
   */
  getDescriptors(): Record<string, unknown>;

  /**
   * Set all descriptors (replaces existing)
   */
  setDescriptors(descriptors: Record<string, unknown>): void;

  /**
   * Get all stored certificates
   * @returns Map of certificates keyed by "targetDevice:publicKeyId:publicKeyUsage"
   */
  getCertificates(): Record<string, unknown>;

  /**
   * Set all certificates (replaces existing)
   */
  setCertificates(certificates: Record<string, unknown>): void;

  /**
   * Clear all stored data
   */
  clear(): void;
}
