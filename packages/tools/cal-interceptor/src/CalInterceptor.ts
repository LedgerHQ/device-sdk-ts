import { MemoryStorage } from "./storage/MemoryStorage";
import type { StorageInterface } from "./storage/StorageInterface";
import { FetchInterceptor } from "./AxiosInterceptor";

/**
 * Metadata-service paths serving dynamic descriptors. Dynamic descriptors carry
 * a single prod signature embedded in the TLV, so they must be re-signed with
 * the CAL interceptor key before a Speculos test device will accept them.
 * Requests to these paths are redirected to the local re-signing proxy
 * (see `DYNAMIC_DESCRIPTOR_PROXY_PREFIX`).
 */
const DYNAMIC_DESCRIPTOR_PATHS = [
  "/v2/solana/alt-resolution",
  "/v2/solana/token-account-state",
];

/**
 * Base path of the sample app's re-signing proxy (Flask
 * `/api/dynamic-descriptor-proxy`, proxied by Next). The original path and query
 * are appended to it.
 */
const DYNAMIC_DESCRIPTOR_PROXY_PREFIX = "/api/dynamic-descriptor-proxy";

/**
 * CAL Interceptor - intercepts CAL (Crypto Assets List) API calls
 * and returns locally stored descriptors when available
 */
export class CalInterceptor {
  private readonly interceptor: FetchInterceptor;
  private readonly storage: StorageInterface;

  constructor(storage?: StorageInterface) {
    // Default to in-memory storage for environment-agnostic behavior
    this.storage = storage ?? new MemoryStorage();
    this.interceptor = new FetchInterceptor(this.modifyCalResponse.bind(this));
  }

  /**
   * Start intercepting CAL requests
   */
  start(): void {
    this.interceptor.start();
    console.log("CAL Interceptor started");
  }

  /**
   * Stop intercepting CAL requests
   */
  stop(): void {
    this.interceptor.stop();
    console.log("CAL Interceptor stopped");
  }

  /**
   * Check if interceptor is currently active
   */
  isActive(): boolean {
    return this.interceptor.isIntercepting();
  }

  /**
   * Get all stored descriptors
   */
  getStoredDescriptors(): Record<string, unknown> {
    return this.storage.getDescriptors();
  }

  /**
   * Store a descriptor
   * Merges with existing descriptor if one exists for the same chainId:address
   */
  storeDescriptor(
    chainId: number,
    address: string,
    descriptorData: unknown,
  ): void {
    try {
      const descriptors = this.getStoredDescriptors();
      const key = `${chainId}:${address.toLowerCase()}`;

      // Expect descriptorData to be an array with one element
      if (Array.isArray(descriptorData) && descriptorData.length > 0) {
        const newDescriptor = descriptorData[0];
        const existing = descriptors[key];

        // If there's existing data, merge the descriptor objects
        if (existing && Array.isArray(existing) && existing.length > 0) {
          const existingDescriptor = existing[0];
          // Merge the two descriptor objects (e.g., descriptors_calldata + descriptors_eip712)
          descriptors[key] = [
            {
              ...existingDescriptor,
              ...newDescriptor,
            },
          ];
          console.log(`Merged descriptors for ${chainId}:${address}`);
        } else {
          // No existing data, store as-is
          descriptors[key] = descriptorData;
          console.log(`Stored new descriptors for ${chainId}:${address}`);
        }

        this.storage.setDescriptors(descriptors);
      } else {
        console.error("Empty descriptor data, nothing to store");
      }
    } catch (error) {
      console.error("Failed to store descriptor:", error);
    }
  }

  /**
   * Get all stored certificates
   */
  getStoredCertificates(): Record<string, unknown> {
    return this.storage.getCertificates();
  }

  /**
   * Store certificates
   */
  storeCertificates(certificates: Record<string, unknown>): void {
    try {
      this.storage.setCertificates(certificates);
      console.log(`Stored ${Object.keys(certificates).length} certificates`);
    } catch (error) {
      console.error("Failed to store certificates:", error);
    }
  }

  /**
   * Clear all stored descriptors and certificates
   */
  clearStoredDescriptors(): void {
    try {
      this.storage.clear();
      console.log("Cleared all stored descriptors and certificates");
    } catch (error) {
      console.error("Failed to clear descriptors:", error);
    }
  }

  /**
   * Get count of stored descriptors
   */
  getStoredDescriptorCount(): number {
    const descriptors = this.getStoredDescriptors();
    return Object.keys(descriptors).length;
  }

  /**
   * Modify CAL response - called by interceptor
   * Returns modified response or null to pass through
   */
  private async modifyCalResponse(url: string): Promise<string | null> {
    try {
      const parsedUrl = new URL(url);

      // Dynamic descriptors (ALT resolution, token account state, ...) embed a
      // signature in the TLV that must be re-signed with the CAL interceptor
      // key, which only the local proxy can do. Fetch them through that proxy
      // and serve the re-signed response.
      const resigned = await this.fetchResignedDynamicDescriptor(parsedUrl);
      if (resigned !== null) {
        return resigned;
      }

      // Check if it's a CAL request
      if (!parsedUrl.pathname.startsWith("/cal")) {
        return null;
      }

      // Handle dapps requests (descriptors_calldata / descriptors_eip712)
      if (parsedUrl.pathname.includes("/dapps")) {
        const output = parsedUrl.searchParams.get("output");
        if (
          output === "descriptors_calldata" ||
          output === "descriptors_eip712"
        ) {
          const chainId = parsedUrl.searchParams.get("chain_id");
          // Get address from contract_address or contracts parameter
          let address = parsedUrl.searchParams.get("contract_address");
          if (!address) {
            address = parsedUrl.searchParams.get("contracts");
          }

          if (chainId && address) {
            const descriptors = this.getStoredDescriptors();
            const key = `${chainId}:${address.toLowerCase()}`;
            const storedData = descriptors[key];

            if (
              storedData &&
              Array.isArray(storedData) &&
              storedData.length > 0
            ) {
              const descriptorObj = storedData[0];
              if (descriptorObj && output in descriptorObj) {
                console.log(`Intercepted dapps request for ${key} (${output})`);
                return JSON.stringify([{ [output]: descriptorObj[output] }]);
              }
            }
          }
        }
      }

      // Handle certificates requests
      if (
        parsedUrl.pathname.includes("/certificates") &&
        parsedUrl.searchParams.get("output") === "descriptor"
      ) {
        const targetDevice = parsedUrl.searchParams.get("target_device");
        const publicKeyUsage = parsedUrl.searchParams.get("public_key_usage");
        const publicKeyId = parsedUrl.searchParams.get("public_key_id");

        if (targetDevice && publicKeyUsage && publicKeyId) {
          const certificates = this.getStoredCertificates();
          const key = `${targetDevice}:${publicKeyId}:${publicKeyUsage}`;
          const certificate = certificates[key];
          if (certificate) {
            console.log(`Intercepted certificate request for ${key}`);
            return JSON.stringify(certificate);
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse URL params:", error);
    }
    return null;
  }

  /**
   * Fetch a dynamic descriptor (ALT resolution, token account state, ...)
   * through the local re-signing proxy and return its (re-signed) body. Returns
   * null when the request is not a dynamic descriptor request that needs
   * re-signing, so the caller passes it through untouched.
   */
  private async fetchResignedDynamicDescriptor(
    parsedUrl: URL,
  ): Promise<string | null> {
    // Ignore requests already targeting the proxy (this method re-enters the
    // interceptor when it fetches, and must not redirect the proxy call itself).
    if (parsedUrl.pathname.startsWith(DYNAMIC_DESCRIPTOR_PROXY_PREFIX)) {
      return null;
    }

    const needsResign = DYNAMIC_DESCRIPTOR_PATHS.some((path) =>
      parsedUrl.pathname.startsWith(path),
    );
    if (!needsResign) {
      return null;
    }

    const base =
      typeof globalThis.location !== "undefined"
        ? globalThis.location.origin
        : parsedUrl.origin;
    const proxyUrl = new URL(
      `${DYNAMIC_DESCRIPTOR_PROXY_PREFIX}${parsedUrl.pathname}${parsedUrl.search}`,
      base,
    ).toString();

    console.log(`Fetching ${parsedUrl.pathname} via re-signing proxy`);
    const response = await fetch(proxyUrl);
    return response.text();
  }
}
