import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalAdapter } from "@root/src/domain/adapters/CalAdapter";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
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
  ): Promise<TransactionInfo[]> {
    this.logger.debug("Getting transactions", {
      data: { address, chainId },
    });
    const selectors = await this.calAdapter.fetchSelectors(chainId, address);

    const results: TransactionInfo[] = [];
    for (const selector of selectors) {
      const tx = await this.etherscanAdapter.fetchRandomTransaction(
        chainId,
        address,
        selector,
      );

      if (!tx) {
        continue;
      }

      const unsignedTx = this.transactionCrafter.craftRawTransaction(
        tx,
        chainId,
      );

      results.push({
        rawTx: unsignedTx,
        transactionData: tx,
      });
    }

    this.logger.debug("Got transactions", {
      data: { results },
    });

    return results;
  }
}
