/**
 * Client for interacting with the ERC7730 processing API
 */

export interface ProcessedDescriptors {
  descriptors: Record<string, unknown>;
}

export interface ERC7730ClientConfig {
  /**
   * Base URL for the API
   * @default "" (uses same origin)
   */
  baseUrl?: string;
}

/**
 * Client for processing ERC7730 descriptors and fetching certificates
 */
export class ERC7730Client {
  private baseUrl: string;

  constructor(config: ERC7730ClientConfig = {}) {
    this.baseUrl = config.baseUrl || "";
  }

  /**
   * Process an ERC7730 descriptor and convert it to CAL format
   * @param erc7730Descriptor - ERC7730 descriptor (JSON string or object)
   * @returns Processed descriptors keyed by "chainId:address"
   */
  async processDescriptor(
    erc7730Descriptor: string | object,
  ): Promise<ProcessedDescriptors> {
    const body =
      typeof erc7730Descriptor === "string"
        ? erc7730Descriptor
        : JSON.stringify(erc7730Descriptor);

    const response = await fetch(
      `${this.baseUrl}/api/process-erc7730-descriptor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Fetch CAL certificates for Speculos testing
   * @returns Certificates keyed by "targetDevice:publicKeyId:publicKeyUsage"
   */
  async fetchCertificates(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/certificates`);

    if (!response.ok) {
      throw new Error(`Failed to fetch certificates: HTTP ${response.status}`);
    }

    return await response.json();
  }
}
