import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type EtherscanConfig } from "@root/src/domain/models/config/EtherscanConfig";
import { type TransactionData } from "@root/src/domain/models/TransactionData";

const ETHERSCAN_TRANSACTIONS_OFFSET = 500;

/**
 * Etherscan API transaction response
 */
type EtherscanTransactionDto = {
  hash: string;
  from: string;
  to: string;
  input: string;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  timeStamp: string;
  isError: string;
  methodId: string;
  type?: string;
  chainId?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  v?: string;
  r?: string;
  s?: string;
};

/**
 * Etherscan API response
 */
type EtherscanApiResponse = {
  status: string;
  message: string;
  result: EtherscanTransactionDto[];
};

/**
 * HTTP Etherscan Service
 *
 * Implements the EtherscanAdapter interface using HTTP requests to Etherscan API.
 * Fetches random transactions by chain ID, contract address, and function selector.
 */
@injectable()
export class HttpEtherscanAdapter implements EtherscanAdapter {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.EtherscanConfig)
    private readonly etherscanConfig: EtherscanConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("etherscan-service");
  }

  async fetchRandomTransaction(
    chainId: number,
    address: string,
    selectors?: string[],
  ): Promise<TransactionData[]> {
    const selectorsInfo = selectors
      ? `selectors ${selectors.join(", ")}`
      : "all selectors";
    this.logger.debug(
      `Fetching random transactions for chain ${chainId}, address ${address}, ${selectorsInfo}`,
    );

    const normalizedAddress = address.toLowerCase();
    const normalizedSelectors = selectors?.map((selector) =>
      selector.toLowerCase().startsWith("0x")
        ? selector.toLowerCase()
        : `0x${selector.toLowerCase()}`,
    );

    try {
      const baseUrl = "https://api.etherscan.io/v2/api";
      const transactions = await this.fetchTransactionsFromEtherscan(
        baseUrl,
        normalizedAddress,
        chainId,
      );

      // Filter only successful transactions to this address
      const matchingTransactions = transactions.filter(
        (tx) => tx.isError === "0" && tx.to.toLowerCase() === normalizedAddress,
      );

      if (matchingTransactions.length === 0) {
        this.logger.warn(`No transactions found for address ${address}`);
        return [];
      }

      // Group transactions by selector
      const transactionsBySelector = new Map<
        string,
        EtherscanTransactionDto[]
      >();

      if (normalizedSelectors) {
        // Filter by specific selectors
        // Initialize the map with all selectors
        for (const selector of normalizedSelectors) {
          transactionsBySelector.set(selector, []);
        }

        // Filter and group transactions by selector
        for (const tx of matchingTransactions) {
          const input = tx.input.toLowerCase();
          for (const selector of normalizedSelectors) {
            if (input.startsWith(selector)) {
              transactionsBySelector.get(selector)!.push(tx);
              break; // Each transaction only belongs to one selector
            }
          }
        }
      } else {
        // Group by all unique selectors found
        for (const tx of matchingTransactions) {
          const selector = tx.methodId;
          if (!transactionsBySelector.has(selector)) {
            transactionsBySelector.set(selector, []);
          }
          transactionsBySelector.get(selector)!.push(tx);
        }
      }

      // Select one random transaction per selector
      const selectedTransactions: TransactionData[] = [];
      for (const [selector, txs] of transactionsBySelector.entries()) {
        if (txs.length === 0) {
          this.logger.warn(
            `No matching transactions found for selector ${selector}`,
          );
          continue;
        }

        const randomTx = this.getRandomItem(txs);
        selectedTransactions.push({
          to: randomTx.to,
          nonce: parseInt(randomTx.nonce, 10),
          data: randomTx.input,
          value: randomTx.value,
          selector: randomTx.methodId,
          hash: randomTx.hash,
        });
      }

      this.logger.debug(
        `Found ${selectedTransactions.length} matching transactions${normalizedSelectors ? ` out of ${normalizedSelectors.length} selectors` : ` with ${transactionsBySelector.size} unique selectors`}`,
      );

      return selectedTransactions;
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = `Failed to fetch transactions from Etherscan: ${error.message}`;
        this.logger.error(errorMessage, {
          data: { error: error.message },
        });
        throw new Error(errorMessage);
      }
      this.logger.error("Unexpected error fetching transactions", {
        data: { error },
      });
      throw error;
    }
  }

  /**
   * Fetch transactions from Etherscan API
   */
  private async fetchTransactionsFromEtherscan(
    baseUrl: string,
    address: string,
    chainId: number,
  ): Promise<EtherscanTransactionDto[]> {
    const params = {
      chainid: chainId,
      module: "account",
      action: "txlist",
      address: address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: ETHERSCAN_TRANSACTIONS_OFFSET,
      sort: "desc",
      apikey: this.etherscanConfig.apiKey,
    };

    this.logger.debug(`Fetching transactions from ${baseUrl}`, {
      data: { params },
    });

    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    const controller = new AbortController();
    const timeoutMs = this.etherscanConfig.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchResponse = await fetch(url, { signal: controller.signal });
      if (!fetchResponse.ok)
        throw new Error(`HTTP error ${fetchResponse.status}`);
      const data = (await fetchResponse.json()) as EtherscanApiResponse;

      this.logger.debug("Etherscan API response", {
        data: {
          status: data.status,
          message: data.message,
          result: JSON.stringify(data.result),
          resultCount: Array.isArray(data.result) ? data.result.length : 0,
        },
      });

      if (data.status !== "1") {
        if (
          data.status === "0" &&
          (data.message === "No transactions found" ||
            data.message === "NOTOK")
        ) {
          this.logger.info(
            `No transactions found for address: ${data.message}`,
          );
          return [];
        }
        throw new Error(
          `Etherscan API error: ${data.message || "Unknown error"}`,
        );
      }

      if (!Array.isArray(data.result)) {
        this.logger.warn("No transactions found");
        return [];
      }

      return data.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get a random item from an array
   */
  private getRandomItem<T>(items: T[]): T {
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex]!;
  }
}
