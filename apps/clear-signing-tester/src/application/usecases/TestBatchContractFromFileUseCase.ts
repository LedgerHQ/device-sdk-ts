import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ContractInput } from "@root/src/domain/models/ContractInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import {
  type BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";

import {
  type TestContractConfig,
  TestContractUseCase,
} from "./TestContractUseCase";

export type BatchContractTestConfig = {
  readonly defaultDerivationPath: string;
  readonly skipCal?: boolean;
  readonly plugin?: string;
};

/**
 * Use case for testing a batch of contracts from a file
 * Reads contract definitions from a JSON file and runs tests for each contract
 */
@injectable()
export class TestBatchContractFromFileUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.ContractFileRepository)
    private readonly contractFileRepository: DataFileRepository<ContractInput>,
    @inject(TYPES.TestContractUseCase)
    private readonly testContractUseCase: TestContractUseCase,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-batch-contract-from-file");
  }

  /**
   * Execute batch testing of contracts from a file
   * @param filePath - Path to the file containing contract data
   * @param config - Batch test configuration
   * @returns Promise<BatchTestResult> - Summary of all test results
   */
  async execute(
    filePath: string,
    config: BatchContractTestConfig,
  ): Promise<BatchTestResult> {
    this.logger.info(`Processing contracts from: ${filePath}`);

    // Read contracts from file
    const contracts = this.contractFileRepository.readFromFile(filePath);

    if (config.plugin) {
      this.logger.info(`Using plugin: ${config.plugin}`);
    }

    // Count total tests (each contract-chainId combination)
    const totalTests = contracts.reduce(
      (sum, contract) => sum + Object.keys(contract.address).length,
      0,
    );

    this.logger.info(
      `Found ${contracts.length} contract${contracts.length !== 1 ? "s" : ""} with ${totalTests} test${totalTests !== 1 ? "s" : ""} to run`,
    );

    const results: TestResult[] = [];

    // Test each contract
    for (const [index, contract] of contracts.entries()) {
      this.logger.info(
        `Testing contract ${index + 1}/${contracts.length}: ${contract.name} (${contract.owner})`,
      );

      // Test each chain for this contract
      const chainIds = Object.keys(contract.address);
      for (const chainId of chainIds) {
        const contractAddress = contract.address[chainId] ?? "";
        this.logger.info(
          `Testing on chain ${chainId} at address ${contractAddress}`,
        );

        try {
          const contractConfig: TestContractConfig = {
            chainId: Number(chainId),
            contractAddress,
            derivationPath: config.defaultDerivationPath,
            skipCal: config.skipCal,
          };

          const batchResult =
            await this.testContractUseCase.execute(contractConfig);

          // Store results with enhanced descriptions
          const enhancedResults = batchResult.resultsTable.map((row) => {
            const testResult: TestResult = {
              input: {
                rawTx: "",
                description: `[${contract.name}/${contract.owner}/Chain ${chainId}] ${row.Description}`,
              },
              status: this.parseStatusFromTable(row.Status),
              timestamp: new Date().toISOString(),
              hash: row.Hash,
            };
            return testResult;
          });

          results.push(...enhancedResults);
          this.logContractResult(contract.name, chainId, batchResult);
        } catch (error) {
          this.logger.error(`Contract test failed: ${contract.name}`, {
            data: { error },
          });

          // Create error result
          const errorResult: TestResult = {
            input: {
              rawTx: "",
              description: `${contract.name} (${contract.owner}) on chain ${chainId}`,
            },
            status: "error",
            timestamp: new Date().toISOString(),
            errorMessage:
              error instanceof Error ? error.message : String(error),
          };
          results.push(errorResult);
        }

        // Add delay between contract tests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return ResultFormatter.formatBatchResults(results, results.length, {
      title: "📋 CONTRACT BATCH TEST RESULTS",
      summaryTitle: `📊 CONTRACT BATCH SUMMARY${config.plugin ? ` (Plugin: ${config.plugin})` : ""} (Total: ${results.length})`,
      includeHash: true,
    });
  }

  /**
   * Log individual contract result
   */
  private logContractResult(
    contractName: string,
    chainId: string,
    batchResult: BatchTestResult,
  ): void {
    const summary = batchResult.summaryTable
      .map((row) => `${row.Status}: ${row.Count}`)
      .join(", ");
    this.logger.debug(`Contract ${contractName} on chain ${chainId} Results:`, {
      data: {
        summary,
        totalTests: batchResult.resultsTable.length,
      },
    });
  }

  /**
   * Parse status from table status string
   */
  private parseStatusFromTable(
    statusString: string,
  ): "clear_signed" | "blind_signed" | "partially_clear_signed" | "error" {
    const lower = statusString.toLowerCase();
    if (lower.includes("clear signed") && !lower.includes("partially")) {
      return "clear_signed";
    } else if (lower.includes("partially clear signed")) {
      return "partially_clear_signed";
    } else if (lower.includes("blind signed")) {
      return "blind_signed";
    } else {
      return "error";
    }
  }
}
