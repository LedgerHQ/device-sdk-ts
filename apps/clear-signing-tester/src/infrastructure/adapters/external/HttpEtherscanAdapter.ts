import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios, { AxiosError } from "axios";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type EtherscanConfig } from "@root/src/domain/models/config/EtherscanConfig";
import { type TransactionData } from "@root/src/domain/models/TransactionData";

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
      if (error instanceof AxiosError) {
        const errorMessage = `${error.status || "Unknown status"}: Failed to fetch transactions from Etherscan`;
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
      offset: 200, // Fetch up to 200 transactions
      sort: "desc",
      apikey: this.etherscanConfig.apiKey,
    };

    this.logger.debug(`Fetching transactions from ${baseUrl}`, {
      data: { params },
    });

    const response = await axios.get<EtherscanApiResponse>(baseUrl, {
      params,
      timeout: this.etherscanConfig.timeout || 30000,
    });

    this.logger.debug("Etherscan API response", {
      data: {
        status: response.data.status,
        message: response.data.message,
        result: JSON.stringify(response.data.result),
        resultCount: Array.isArray(response.data.result)
          ? response.data.result.length
          : 0,
      },
    });

    if (response.data.status !== "1") {
      // Status "0" with "No transactions found" or "NOTOK" is not an error, just means no data
      if (
        response.data.status === "0" &&
        (response.data.message === "No transactions found" ||
          response.data.message === "NOTOK")
      ) {
        this.logger.info(
          `No transactions found for address: ${response.data.message}`,
        );
        return [];
      }
      throw new Error(
        `Etherscan API error: ${response.data.message || "Unknown error"}`,
      );
    }

    if (!Array.isArray(response.data.result)) {
      this.logger.warn("No transactions found");
      return [];
    }

    return response.data.result;
  }

  /**
   * Get a random item from an array
   */
  private getRandomItem<T>(items: T[]): T {
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex]!;
  }
}
