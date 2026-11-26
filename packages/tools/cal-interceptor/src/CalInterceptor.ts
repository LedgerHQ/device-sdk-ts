import { MemoryStorage } from "./storage/MemoryStorage";
import type { StorageInterface } from "./storage/StorageInterface";
import { FetchInterceptor, type InterceptedRequest } from "./AxiosInterceptor";

/**
 * Host of the metadata service. Its descriptors carry a prod signature, so
 * every GET and POST to it goes through the re-signing proxy, which re-signs
 * those the device checks under a key the interceptor's certificates replace.
 */
const DEFAULT_METADATA_SERVICE_HOST = "nft.api.live.ledger.com";

/**
 * Methods sent through the re-signing proxy: GET for most descriptors, POST
 * for the proxy delegate one. HEAD goes straight to the service, since the
 * clear-signing tester's probes must see its real answer.
 */
const PROXIED_METHODS: ReadonlySet<string> = new Set(["GET", "POST"]);

/**
 * Base path of the sample app's re-signing proxy (Flask
 * `/api/dynamic-descriptor-proxy`, proxied by Next). The original path and query
 * are appended to it.
 */
const DYNAMIC_DESCRIPTOR_PROXY_PREFIX = "/api/dynamic-descriptor-proxy";

const jsonResponse = (body: string): Response =>
  new Response(body, {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
  });

/**
 * Options of {@link CalInterceptor}.
 */
export type CalInterceptorOptions = {
  /** Where descriptors and certificates are kept. Defaults to memory. */
  storage?: StorageInterface;
  /**
   * Base URL of the re-signing proxy (the sample app's Flask API), such as
   * `http://127.0.0.1:5328`. Needed outside a browser; in a browser it
   * defaults to `location.origin`.
   */
  dynamicDescriptorProxyBaseUrl?: string;
  /**
   * Metadata-service host whose GET and POST requests go through the
   * re-signing proxy. Defaults to `nft.api.live.ledger.com`.
   */
  metadataServiceHost?: string;
};

const isStorage = (
  value: StorageInterface | CalInterceptorOptions,
): value is StorageInterface =>
  typeof (value as StorageInterface).getDescriptors === "function";

/**
 * CAL Interceptor - intercepts CAL (Crypto Assets List) API calls
 * and returns locally stored descriptors when available
 */
export class CalInterceptor {
  private readonly interceptor: FetchInterceptor;
  private readonly storage: StorageInterface;
  private readonly dynamicDescriptorProxyBaseUrl: string | undefined;
  private readonly metadataServiceHost: string;
  private hasWarnedMissingProxyBaseUrl = false;

  /**
   * @param storageOrOptions - a storage, as before, or the options. A bare
   * storage is kept for the callers that only pass one.
   */
  constructor(storageOrOptions?: StorageInterface | CalInterceptorOptions) {
    const options: CalInterceptorOptions =
      storageOrOptions === undefined
        ? {}
        : isStorage(storageOrOptions)
          ? { storage: storageOrOptions }
          : storageOrOptions;
    // Default to in-memory storage for environment-agnostic behavior
    this.storage = options.storage ?? new MemoryStorage();
    this.dynamicDescriptorProxyBaseUrl = options.dynamicDescriptorProxyBaseUrl;
    this.metadataServiceHost =
      options.metadataServiceHost ?? DEFAULT_METADATA_SERVICE_HOST;
    this.interceptor = new FetchInterceptor(this.interceptRequest.bind(this));
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
   * Called by the fetch interceptor for every request.
   * Returns the response to serve, or null to pass through
   */
  private async interceptRequest({
    url,
    method,
    init,
    readBody,
  }: InterceptedRequest): Promise<Response | null> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      console.error("Failed to parse URL params:", error);
      return null;
    }

    // Metadata-service descriptors carry a prod signature that only the
    // re-signing proxy can replace, so fetch them through it.
    if (this.isMetadataServiceRequest(parsedUrl, method)) {
      return this.fetchThroughResigningProxy(parsedUrl, init, readBody);
    }

    const storedResponse = this.getStoredCalResponse(parsedUrl);
    return storedResponse === null ? null : jsonResponse(storedResponse);
  }

  /**
   * Look up a CAL request in the stored descriptors and certificates
   * Returns the stored JSON or null to pass through
   */
  private getStoredCalResponse(parsedUrl: URL): string | null {
    try {
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
   * Whether a request is a metadata-service request to send through the
   * re-signing proxy (see PROXIED_METHODS).
   */
  private isMetadataServiceRequest(parsedUrl: URL, method: string): boolean {
    return (
      PROXIED_METHODS.has(method) &&
      parsedUrl.host === this.metadataServiceHost &&
      // The proxy call re-enters the interceptor: never redirect it again.
      !parsedUrl.pathname.startsWith(DYNAMIC_DESCRIPTOR_PROXY_PREFIX)
    );
  }

  /**
   * Fetch a metadata-service request through the re-signing proxy and return
   * the proxy's response as it is, error statuses included. Returns null, so
   * the request goes through untouched, when there is no proxy to reach.
   *
   * @param readBody - Reads the body of a `Request` input, see
   * InterceptedRequest
   */
  private async fetchThroughResigningProxy(
    parsedUrl: URL,
    init?: RequestInit,
    readBody?: () => Promise<ArrayBuffer>,
  ): Promise<Response | null> {
    const baseUrl = this.getProxyBaseUrl();
    if (baseUrl === null) {
      return null;
    }

    const origin = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const proxyUrl = `${origin}${DYNAMIC_DESCRIPTOR_PROXY_PREFIX}${parsedUrl.pathname}${parsedUrl.search}`;
    console.log(`Fetching ${parsedUrl.pathname} via re-signing proxy`);
    return fetch(
      proxyUrl,
      readBody === undefined ? init : { ...init, body: await readBody() },
    );
  }

  /**
   * The proxy's base URL: the configured one, else the page's origin in a
   * browser. Outside a browser the upstream origin has no proxy, so there is
   * no fallback: warn once and return null.
   */
  private getProxyBaseUrl(): string | null {
    if (this.dynamicDescriptorProxyBaseUrl) {
      return this.dynamicDescriptorProxyBaseUrl;
    }
    if (typeof globalThis.location !== "undefined") {
      return globalThis.location.origin;
    }
    if (!this.hasWarnedMissingProxyBaseUrl) {
      this.hasWarnedMissingProxyBaseUrl = true;
      console.warn(
        `CAL Interceptor: no dynamicDescriptorProxyBaseUrl outside a browser, so ${this.metadataServiceHost} responses are not re-signed`,
      );
    }
    return null;
  }
}
