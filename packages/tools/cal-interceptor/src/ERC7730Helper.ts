import { type CalInterceptor } from "./CalInterceptor";
import { type ERC7730Client } from "./ERC7730Client";

/**
 * Helper functions for working with ERC7730 descriptors and CAL interceptor
 */

export interface AddERC7730Options {
  /**
   * ERC7730 descriptor (JSON string or object)
   */
  descriptor: string | object;

  /**
   * CAL interceptor instance
   */
  interceptor: CalInterceptor;

  /**
   * ERC7730 API client
   */
  client: ERC7730Client;

  /**
   * Auto-start interceptor after adding descriptor
   * @default true
   */
  autoStart?: boolean;
}

export interface AddERC7730Result {
  /**
   * Number of descriptors added
   */
  count: number;

  /**
   * Keys of added descriptors (chainId:address)
   */
  keys: string[];
}

/**
 * Process an ERC7730 descriptor and store it in the interceptor
 */
export async function addERC7730Descriptor(
  options: AddERC7730Options,
): Promise<AddERC7730Result> {
  const { descriptor, interceptor, client, autoStart = true } = options;

  // Process the descriptor via the API
  const { descriptors } = await client.processDescriptor(descriptor);

  // Store each descriptor
  const keys: string[] = [];
  Object.entries(descriptors).forEach(([key, descriptorData]) => {
    const parts = key.split(":");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const chainId = parts[0];
      const address = parts[1];
      interceptor.storeDescriptor(parseInt(chainId), address, descriptorData);
      keys.push(key);
    }
  });

  // Auto-start interceptor if requested
  if (autoStart && !interceptor.isActive()) {
    await fetchAndStoreCertificates(interceptor, client);
    interceptor.start();
  }

  return {
    count: keys.length,
    keys,
  };
}

/**
 * Fetch and store CAL certificates in the interceptor
 */
export async function fetchAndStoreCertificates(
  interceptor: CalInterceptor,
  client: ERC7730Client,
): Promise<void> {
  const certificates = await client.fetchCertificates();
  interceptor.storeCertificates(certificates);
}

/**
 * Setup interceptor with certificates
 */
export async function setupInterceptorWithCertificates(
  interceptor: CalInterceptor,
  client: ERC7730Client,
): Promise<void> {
  await fetchAndStoreCertificates(interceptor, client);
  if (!interceptor.isActive()) {
    interceptor.start();
  }
}
