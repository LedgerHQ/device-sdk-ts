import type { StorageInterface } from "./StorageInterface";

const DEFAULT_DESCRIPTORS_KEY = "erc7730_descriptors";
const DEFAULT_CERTIFICATES_KEY = "cal_certificates";

/**
 * Browser localStorage implementation of StorageAdapter
 */
export class LocalStorage implements StorageInterface {
  constructor(
    private readonly descriptorsKey: string = DEFAULT_DESCRIPTORS_KEY,
    private readonly certificatesKey: string = DEFAULT_CERTIFICATES_KEY,
  ) {}

  getDescriptors(): Record<string, unknown> {
    try {
      const stored = localStorage.getItem(this.descriptorsKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to read stored descriptors:", error);
      return {};
    }
  }

  setDescriptors(descriptors: Record<string, unknown>): void {
    try {
      localStorage.setItem(this.descriptorsKey, JSON.stringify(descriptors));
    } catch (error) {
      console.error("Failed to store descriptors:", error);
    }
  }

  getCertificates(): Record<string, unknown> {
    try {
      const stored = localStorage.getItem(this.certificatesKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to read stored certificates:", error);
      return {};
    }
  }

  setCertificates(certificates: Record<string, unknown>): void {
    try {
      localStorage.setItem(this.certificatesKey, JSON.stringify(certificates));
    } catch (error) {
      console.error("Failed to store certificates:", error);
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.descriptorsKey);
      localStorage.removeItem(this.certificatesKey);
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  }
}
