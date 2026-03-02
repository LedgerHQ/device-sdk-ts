import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalAdapter } from "@root/src/domain/adapters/CalAdapter";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";

const CAL_BASE_URL = "https://crypto-assets-service.api.ledger.com/v1";

/**
 * Response DTO from the crypto-assets-service API
 */
type CalldataDto = {
  descriptors_calldata: {
    [address: string]: {
      [selector: string]: unknown;
    };
  };
};

/**
 * HTTP CAL Service
 *
 * Implements the CalAdapter interface using HTTP requests to Ledger's
 * Crypto Assets Ledger (CAL) service API.
 */
@injectable()
export class HttpCalAdapter implements CalAdapter {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SignerConfig)
    private readonly signerConfig: SignerConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("cal-service");
  }

  async fetchSelectors(
    chainId: number,
    contractAddress: string,
  ): Promise<string[]> {
    this.logger.debug(
      `Fetching selectors for contract ${contractAddress} on chain ${chainId}`,
    );

    try {
      const url = new URL(`${CAL_BASE_URL}/dapps`);
      url.searchParams.set("output", "descriptors_calldata");
      url.searchParams.set("chain_id", String(chainId));
      url.searchParams.set("contracts", contractAddress);
      url.searchParams.set("ref", "branch:next");

      const fetchResponse = await fetch(url, {
        method: "GET",
        headers: {
          "X-Ledger-Client-Origin": this.signerConfig.originToken,
        },
      });

      if (!fetchResponse.ok)
        throw new Error(`HTTP error ${fetchResponse.status}`);

      const data = (await fetchResponse.json()) as CalldataDto[];

      const selectors = this.extractSelectorsFromResponse(
        data,
        contractAddress,
      );

      return selectors;
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = `Failed to fetch selectors from ${CAL_BASE_URL}/dapps for contract ${contractAddress} on chain ${chainId}: ${error.message}`;
        this.logger.error(errorMessage, {
          data: { error: error.message },
        });
        throw new Error(errorMessage);
      }
      this.logger.error("Unexpected error fetching selectors", {
        data: { error },
      });
      throw error;
    }
  }

  /**
   * Extract selectors from the API response
   * @param data - Response data from the API
   * @param contractAddress - The contract address to extract selectors for
   * @returns Array of function selectors
   */
  private extractSelectorsFromResponse(
    data: CalldataDto[],
    contractAddress: string,
  ): string[] {
    if (!Array.isArray(data) || data.length === 0) {
      this.logger.warn(`No data returned for contract ${contractAddress}`);
      return [];
    }

    const selectors: string[] = [];
    const normalizedAddress = contractAddress.toLowerCase();

    for (const dto of data) {
      if (!dto.descriptors_calldata) {
        continue;
      }

      // Find the contract address in the response (case-insensitive)
      for (const [address, selectorMap] of Object.entries(
        dto.descriptors_calldata,
      )) {
        if (address.toLowerCase() === normalizedAddress) {
          // Extract all selectors for this contract
          selectors.push(...Object.keys(selectorMap));
        }
      }
    }

    this.logger.info(
      `Successfully fetched ${selectors.length} selectors for contract ${contractAddress}`,
      { data: { selectors } },
    );

    return selectors;
  }
}
