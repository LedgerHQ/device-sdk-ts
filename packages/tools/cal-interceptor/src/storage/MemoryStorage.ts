import type { StorageInterface } from "./StorageInterface";

/**
 * In-memory implementation of StorageAdapter
 */
export class MemoryStorage implements StorageInterface {
  private descriptors: Record<string, unknown> = {};
  private certificates: Record<string, unknown> = {};

  getDescriptors(): Record<string, unknown> {
    return { ...this.descriptors };
  }

  setDescriptors(descriptors: Record<string, unknown>): void {
    this.descriptors = { ...descriptors };
  }

  getCertificates(): Record<string, unknown> {
    return { ...this.certificates };
  }

  setCertificates(certificates: Record<string, unknown>): void {
    this.certificates = { ...certificates };
  }

  clear(): void {
    this.descriptors = {};
    this.certificates = {};
  }
}
