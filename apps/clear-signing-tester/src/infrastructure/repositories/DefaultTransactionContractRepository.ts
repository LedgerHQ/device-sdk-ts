import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalAdapter } from "@root/src/domain/adapters/CalAdapter";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { type TransactionData } from "@root/src/domain/models/TransactionData";
import { TransactionInfo } from "@root/src/domain/models/TransactionInfo";
import { type TransactionContractRepository } from "@root/src/domain/repositories/TransactionContractRepository";

@injectable()
export class DefaultTransactionContractRepository
  implements TransactionContractRepository
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.EtherscanAdapter)
    private readonly etherscanAdapter: EtherscanAdapter,
    @inject(TYPES.CalAdapter)
    private readonly calAdapter: CalAdapter,
    @inject(TYPES.TransactionCrafter)
    private readonly transactionCrafter: TransactionCrafter,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("contract-tx-repository");
  }

  async getTransactions(
    address: string,
    chainId: number,
    skipCal: boolean = false,
  ): Promise<TransactionInfo[]> {
    this.logger.debug("Getting transactions", {
      data: { address, chainId, skipCal },
    });

    const transactions = skipCal
      ? await this.fetchTransactionsWithoutCal(chainId, address)
      : await this.fetchTransactionsWithCal(chainId, address);

    const results = transactions.map((tx) =>
      this.createTransactionInfo(tx, chainId),
    );

    this.logger.debug("Got transactions", {
      data: { count: results.length },
    });

    return results;
  }

  /**
   * Fetch transactions without CAL filtering (directly from Etherscan)
   */
  private async fetchTransactionsWithoutCal(
    chainId: number,
    address: string,
  ): Promise<TransactionData[]> {
    this.logger.info("Skipping CAL, fetching transactions from Etherscan");
    return this.etherscanAdapter.fetchRandomTransactionWithoutFilter(
      chainId,
      address,
    );
  }

  /**
   * Fetch transactions with CAL filtering (by selectors)
   */
  private async fetchTransactionsWithCal(
    chainId: number,
    address: string,
  ): Promise<TransactionData[]> {
    const selectors = await this.calAdapter.fetchSelectors(chainId, address);
    const transactions: TransactionData[] = [];

    for (const selector of selectors) {
      const tx = await this.etherscanAdapter.fetchRandomTransaction(
        chainId,
        address,
        selector,
      );

      if (tx) {
        transactions.push(tx);
      }
    }

    return transactions;
  }

  /**
   * Create TransactionInfo from TransactionData
   */
  private createTransactionInfo(
    tx: TransactionData,
    chainId: number,
  ): TransactionInfo {
    const unsignedTx = this.transactionCrafter.craftRawTransaction(tx, chainId);

    return {
      rawTx: unsignedTx,
      transactionData: tx,
    };
  }
}
