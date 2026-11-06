import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";
import { type SafeAddressRepository } from "@root/src/domain/repositories/SafeAddressRepository";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { type TestResult } from "@root/src/domain/types/TestStatus";

/** Verify one Safe address on the device and report what its review showed. */
@injectable()
export class TestSafeAddressUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SafeAddressRepository)
    private readonly safeAddressRepository: SafeAddressRepository,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-safe-address");
  }

  async execute(input: SafeAddressInput): Promise<TestResult> {
    this.logger.info(`Verifying Safe address: ${input.description}`);

    await this.safeAddressRepository.verifySafeAddress(input);

    const analysis = await this.screenAnalyzer.analyzeAccumulatedTexts(
      input.expectedTexts ?? [],
      input.unexpectedTexts ?? [],
    );

    return {
      input,
      status: analysis.containsAll ? "clear_signed" : "partially_clear_signed",
      timestamp: new Date().toISOString(),
    };
  }
}
