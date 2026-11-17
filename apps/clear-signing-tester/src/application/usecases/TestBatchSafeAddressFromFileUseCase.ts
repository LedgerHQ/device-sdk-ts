import {
  getLogger,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";
import { type ScenarioSlice } from "@root/src/domain/models/Scenario";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import {
  delay,
  INTER_CASE_DELAY_MS,
} from "@root/src/domain/utils/interCaseDelay";
import {
  type BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";
import { type SafeAddressFileRepository } from "@root/src/infrastructure/repositories/SafeAddressFileRepository";

import { TestSafeAddressUseCase } from "./TestSafeAddressUseCase";

/** Verify every Safe address in a file. */
@injectable()
export class TestBatchSafeAddressFromFileUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SafeAddressFileRepository)
    private readonly fileRepository: SafeAddressFileRepository,
    @inject(TYPES.TestSafeAddressUseCase)
    private readonly testSafeAddress: TestSafeAddressUseCase,
  ) {
    this.logger = getLogger("test-batch-safe-address");
  }

  async execute(
    filePath: string,
    slice?: ScenarioSlice,
  ): Promise<BatchTestResult> {
    this.logger.info(`Processing Safe addresses from: ${filePath}`);

    const allInputs = this.fileRepository.readFromFile(filePath);
    const inputs = slice
      ? allInputs.filter((_, index) => index % slice.count === slice.index - 1)
      : allInputs;
    this.logger.info(
      `Found ${inputs.length} Safe address(es) to test` +
        (slice ? ` (case ${slice.index}/${slice.count})` : ""),
    );

    const results: TestResult[] = [];

    for (const [index, input] of inputs.entries()) {
      this.logger.info(
        `Testing Safe address ${index + 1}/${inputs.length}: ${input.description}`,
      );

      results.push(await this.runSafeAddress(input, index));

      if (index < inputs.length - 1) await delay(INTER_CASE_DELAY_MS);
    }

    return ResultFormatter.formatBatchResults(results, inputs.length);
  }

  private async runSafeAddress(
    input: SafeAddressInput,
    index: number,
  ): Promise<TestResult> {
    try {
      return await this.testSafeAddress.execute(input);
    } catch (error) {
      this.logger.error(`Safe address ${index + 1} failed`, {
        data: { error },
      });

      return {
        input,
        status: "error",
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
