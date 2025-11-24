import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type TransactionContractRepository } from "@root/src/domain/repositories/TransactionContractRepository";
import { TestResult } from "@root/src/domain/types/TestStatus";
import {
  BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";

export type TestContractConfig = {
  readonly chainId: number;
  readonly contractAddress: string;
  readonly derivationPath: string;
  readonly skipCal?: boolean;
};

@injectable()
export class TestContractUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.TransactionContractRepository)
    private readonly txRepository: TransactionContractRepository,
    @inject(TYPES.DeviceRepository)
    private readonly deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-contract");
  }

  async execute(config: TestContractConfig): Promise<BatchTestResult> {
    const txs = await this.txRepository.getTransactions(
      config.contractAddress,
      config.chainId,
      config.skipCal,
    );

    if (txs.length === 0) {
      console.warn("No transactions found");
      throw new Error("No transactions found");
    }

    const results: TestResult[] = [];

    // Test each transaction
    for (const [index, tx] of txs.entries()) {
      const { selector, hash } = tx.transactionData;
      const transaction = {
        rawTx: tx.rawTx!,
        description: selector,
      };

      this.logger.info(`Testing transaction ${index + 1}/${txs.length}`);

      try {
        const result = await this.deviceRepository.performSignTransaction(
          transaction,
          config.derivationPath,
        );

        results.push({
          ...result,
          hash,
        });

        this.logTransactionResult(result, index + 1);
      } catch (error) {
        this.logger.error(`Transaction ${index + 1} failed`, {
          data: { error },
        });

        // Create error result
        const errorResult: TestResult = {
          input: transaction,
          status: "error",
          timestamp: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        };
        results.push(errorResult);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return ResultFormatter.formatBatchResults(results, txs.length, {
      title: "📋 TRANSACTION TEST RESULTS",
      summaryTitle: `📊 TRANSACTION BATCH SUMMARY (Total: ${txs.length})`,
      includeHash: true,
    });
  }

  /**
   * Log individual transaction result
   */
  private logTransactionResult(result: TestResult, index: number): void {
    this.logger.debug(`Transaction ${index} Results:`, {
      data: {
        status: result.status,
        description: result.input.description,
        timestamp: result.timestamp,
        ...(result.errorMessage && { error: result.errorMessage }),
      },
    });
  }
}
