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
    selector: string,
  ): Promise<TransactionData | undefined> {
    this.logger.debug(
      `Fetching random transactions for chain ${chainId}, address ${address}, selector ${selector}`,
    );

    const normalizedAddress = address.toLowerCase();
    const normalizedSelector = selector.toLowerCase().startsWith("0x")
      ? selector.toLowerCase()
      : `0x${selector.toLowerCase()}`;

    try {
      const baseUrl = "https://api.etherscan.io/v2/api";
      const transactions = await this.fetchTransactionsFromEtherscan(
        baseUrl,
        normalizedAddress,
        chainId,
      );

      // Filter transactions by selector
      const matchingTransactions = transactions.filter((tx) => {
        const input = tx.input.toLowerCase();
        return (
          input.startsWith(normalizedSelector) &&
          tx.isError === "0" &&
          tx.to.toLowerCase() === normalizedAddress
        );
      });

      this.logger.debug(
        `Found ${matchingTransactions.length} matching transactions`,
      );

      if (matchingTransactions.length === 0) {
        this.logger.warn(
          `No matching transactions found for selector ${selector}`,
        );
        return undefined;
      }

      // Select one random transaction
      const selectedTransaction = this.getRandomItem(matchingTransactions);

      const transactionData: TransactionData = {
        to: selectedTransaction.to,
        nonce: parseInt(selectedTransaction.nonce, 10),
        data: selectedTransaction.input,
        value: selectedTransaction.value,
        selector: selectedTransaction.methodId,
        hash: selectedTransaction.hash,
      };

      return transactionData;
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
