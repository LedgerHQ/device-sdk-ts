import { inject, injectable } from "inversify";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import type { TypedDataFileRepository } from "@root/src/domain/repositories/TypedDataFileRepository";
import { TYPES } from "@root/src/di/types";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { ResultDisplayService } from "@root/src/services/ResultDisplayService";
import { TestResult } from "@root/src/domain/types/TestStatus";

/**
 * Configuration for batch typed data testing
 */
export interface BatchTypedDataTestConfig {
    readonly defaultDerivationPath: string;
}

/**
 * Result summary for batch typed data testing
 */
export interface BatchTypedDataTestResult {
    readonly totalItems: number;
    readonly clearSignedCount: number;
    readonly blindSignedCount: number;
    readonly partiallyClearSignedCount: number;
    readonly errorCount: number;
    readonly results: TestResult[];
}

/**
 * Use case for testing a batch of typed data from a file
 * Orchestrates file reading and individual typed data testing
 */
@injectable()
export class TestBatchTypedDataFromFileUseCase {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.TypedDataFileRepository)
        private readonly typedDataFileRepository: TypedDataFileRepository,
        @inject(TYPES.DeviceRepository)
        private readonly deviceRepository: DeviceRepository,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
        @inject(TYPES.ResultDisplayService)
        private readonly resultDisplayService: ResultDisplayService,
    ) {
        this.logger = loggerFactory("test-batch-typed-data");
    }

    /**
     * Execute batch testing of typed data from a file
     * @param filePath - Path to the file containing typed data
     * @param config - Batch test configuration
     * @returns Promise<BatchTypedDataTestResult> - Summary of all test results
     */
    async execute(
        filePath: string,
        config: BatchTypedDataTestConfig,
    ): Promise<BatchTypedDataTestResult> {
        this.logger.info(`Processing typed data from: ${filePath}`);

        // Read typed data from file
        const typedDataArray =
            await this.typedDataFileRepository.readTypedDataFromFile(filePath);

        this.logger.info(
            `Found ${typedDataArray.length} typed data objects to test`,
        );

        const results: TestResult[] = [];
        let clearSignedCount = 0;
        let blindSignedCount = 0;
        let partiallyClearSignedCount = 0;
        let errorCount = 0;

        // Test each typed data
        for (const [index, typedData] of typedDataArray.entries()) {
            this.logger.info(
                `Testing typed data ${index + 1}/${typedDataArray.length}`,
            );

            try {
                const result = await this.deviceRepository.performSignTypedData(
                    typedData,
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

                this.logTypedDataResult(result, index + 1);
            } catch (error) {
                errorCount++;
                this.logger.error(`Typed data ${index + 1} failed`, {
                    data: { error },
                });

                // Create error result
                const errorResult: TestResult = {
                    input: typedData,
                    status: "error",
                    timestamp: new Date().toISOString(),
                    errorMessage:
                        error instanceof Error ? error.message : String(error),
                };
                results.push(errorResult);
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const batchResult: BatchTypedDataTestResult = {
            totalItems: typedDataArray.length,
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
     * Log individual typed data result
     */
    private logTypedDataResult(result: TestResult, index: number): void {
        this.logger.debug(`Typed data ${index} Results:`, {
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
    private logBatchSummary(result: BatchTypedDataTestResult): void {
        this.resultDisplayService.displayResultsTable(
            result.results,
            "TYPED DATA",
        );
        this.resultDisplayService.displaySummaryTable(result, "TYPED DATA");
    }
}
