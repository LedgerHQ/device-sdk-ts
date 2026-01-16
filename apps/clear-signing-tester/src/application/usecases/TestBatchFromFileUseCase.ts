import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { TestResult } from "@root/src/domain/types/TestStatus";
import {
  BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";

/**
 * Configuration for batch testing
 */
export type BatchTestConfig = {
  readonly defaultDerivationPath: string;
};

/**
 * Configuration for formatting test results
 */
export type TestFormattingConfig = {
  readonly title: string;
  readonly summaryTitle: string;
  readonly itemName: string; // e.g., "transaction", "typed data"
};

/**
 * Generic use case for testing a batch of items from a file
 * Works with any data type T through the DataFileRepository interface
 */
@injectable()
export class TestBatchFromFileUseCase<
  T extends TransactionInput | TypedDataInput,
> {
  private readonly logger: LoggerPublisherService;

  constructor(
    private readonly dataFileRepository: DataFileRepository<T>,
    @inject(TYPES.DeviceRepository)
    private readonly deviceRepository: DeviceRepository,
    private readonly signOperation: (
      deviceRepository: DeviceRepository,
      input: T,
      derivationPath: string,
    ) => Promise<TestResult>,
    private readonly formattingConfig: TestFormattingConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    loggerTag: string,
  ) {
    this.logger = loggerFactory(loggerTag);
  }

  /**
   * Execute batch testing of items from a file
   * @param filePath - Path to the file containing data
   * @param config - Batch test configuration
   * @returns Promise<BatchTestResult> - Summary of all test results
   */
  async execute(
    filePath: string,
    config: BatchTestConfig,
  ): Promise<BatchTestResult> {
    this.logger.info(
      `Processing ${this.formattingConfig.itemName}s from: ${filePath}`,
    );

    // Read data from file
    const items = this.dataFileRepository.readFromFile(filePath);

    this.logger.info(
      `Found ${items.length} ${this.formattingConfig.itemName}${items.length !== 1 ? "s" : ""} to test`,
    );

    const results: TestResult[] = [];

    // Test each item
    for (const [index, item] of items.entries()) {
      this.logger.info(
        `Testing ${this.formattingConfig.itemName} ${index + 1}/${items.length}`,
      );

      try {
        const result = await this.signOperation(
          this.deviceRepository,
          item,
          config.defaultDerivationPath,
        );

        results.push(result);
        this.logItemResult(result, index + 1);
      } catch (error) {
        this.logger.error(
          `${this.formattingConfig.itemName.charAt(0).toUpperCase() + this.formattingConfig.itemName.slice(1)} ${index + 1} failed`,
          { data: { error } },
        );

        // Create error result
        const errorResult: TestResult = {
          input: item,
          status: "error",
          timestamp: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        };
        results.push(errorResult);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return ResultFormatter.formatBatchResults(results, items.length, {
      title: this.formattingConfig.title,
      summaryTitle: this.formattingConfig.summaryTitle,
    });
  }

  /**
   * Log individual item result
   */
  private logItemResult(result: TestResult, index: number): void {
    this.logger.debug(
      `${this.formattingConfig.itemName.charAt(0).toUpperCase() + this.formattingConfig.itemName.slice(1)} ${index} Results:`,
      {
        data: {
          status: result.status,
          description: result.input.description,
          timestamp: result.timestamp,
          ...(result.errorMessage && { error: result.errorMessage }),
        },
      },
    );
  }
}
