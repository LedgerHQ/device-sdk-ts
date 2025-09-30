import { inject, injectable } from "inversify";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import type { TransactionFileRepository } from "@root/src/domain/repositories/TransactionFileRepository";
import { TestResult } from "@root/src/domain/types/TestStatus";
import { TYPES } from "@root/src/di/types";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { ResultDisplayService } from "@root/src/services/ResultDisplayService";

/**
 * Configuration for batch testing
 */
export interface BatchTestConfig {
    readonly defaultDerivationPath: string;
}

/**
 * Result summary for batch testing
 */
export interface BatchTestResult {
    readonly totalItems: number;
    readonly clearSignedCount: number;
    readonly blindSignedCount: number;
    readonly partiallyClearSignedCount: number;
    readonly errorCount: number;
    readonly results: TestResult[];
}

/**
 * Use case for testing a batch of transactions from a file
 * Orchestrates file reading and individual transaction testing
 */
@injectable()
export class TestBatchTransactionFromFileUseCase {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.TransactionFileRepository)
        private readonly transactionFileRepository: TransactionFileRepository,
        @inject(TYPES.DeviceRepository)
        private readonly deviceRepository: DeviceRepository,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
        @inject(TYPES.ResultDisplayService)
        private readonly resultDisplayService: ResultDisplayService,
    ) {
        this.logger = loggerFactory("test-batch-transaction");
    }

    /**
     * Execute batch testing of transactions from a file
     * @param config - Batch test configuration
     * @returns Promise<BatchTestResult> - Summary of all test results
     */
    async execute(
        filePath: string,
        config: BatchTestConfig,
    ): Promise<BatchTestResult> {
        this.logger.info(`Processing transactions from: ${filePath}`);

        // Read transactions from file
        const transactions =
            await this.transactionFileRepository.readTransactionsFromFile(
                filePath,
            );

        this.logger.info(`Found ${transactions.length} transactions to test`);

        const results: TestResult[] = [];
        let clearSignedCount = 0;
        let blindSignedCount = 0;
        let partiallyClearSignedCount = 0;
        let errorCount = 0;

        // Test each transaction
        for (const [index, transaction] of transactions.entries()) {
            this.logger.info(
                `Testing transaction ${index + 1}/${transactions.length}`,
            );

            try {
                const result =
                    await this.deviceRepository.performSignTransaction(
                        transaction,
                        config.defaultDerivationPath,
                    );

                results.push(result);

                // Update counters based on result
                switch (result.status) {
                    case "clear_signed":
                        clearSignedCount++;
                        break;
                    case "blind_signed":
                        blindSignedCount++;
                        break;
                    case "partially_clear_signed":
                        partiallyClearSignedCount++;
                        break;
                    case "error":
                        errorCount++;
                        break;
                }

                this.logTransactionResult(result, index + 1);
            } catch (error) {
                errorCount++;
                this.logger.error(`Transaction ${index + 1} failed`, {
                    data: { error },
                });

                // Create error result
                const errorResult: TestResult = {
                    input: transaction,
                    status: "error",
                    timestamp: new Date().toISOString(),
                    errorMessage:
                        error instanceof Error ? error.message : String(error),
                };
                results.push(errorResult);
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const batchResult: BatchTestResult = {
            totalItems: transactions.length,
            clearSignedCount,
            blindSignedCount,
            partiallyClearSignedCount,
            errorCount,
            results,
        };

        this.logBatchSummary(batchResult);

        return batchResult;
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

    /**
     * Log batch test summary
     */
    private logBatchSummary(result: BatchTestResult): void {
        this.resultDisplayService.displayResultsTable(
            result.results,
            "TRANSACTION",
        );
        this.resultDisplayService.displaySummaryTable(result, "TRANSACTION");
    }
}
