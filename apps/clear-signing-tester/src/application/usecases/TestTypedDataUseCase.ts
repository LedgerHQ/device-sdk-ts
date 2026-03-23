import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { TestResult } from "@root/src/domain/types/TestStatus";
import { ResultFormatter } from "@root/src/domain/utils/ResultFormatter";

export type TypedDataTestConfig = {
  readonly derivationPath: string;
};

export type TypedDataTestResult = {
  readonly title: string;
  readonly data: {
    Description: string;
    Status: string;
    Timestamp: string;
    Error?: string;
  };
  readonly exitCode: number;
};

@injectable()
export class TestTypedDataUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.DeviceRepository)
    private readonly deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-typed-object");
  }

  async execute(
    typedData: TypedDataInput,
    config: TypedDataTestConfig,
  ): Promise<TypedDataTestResult> {
    this.logger.debug("Executing typed object test", {
      data: { typedData, description: "single typed data" },
    });

    const result = await this.deviceRepository.performSignTypedData(
      typedData,
      config.derivationPath,
    );

    return this.formatResult(result);
  }

  /**
   * Format result for CLI display
   */
  private formatResult(result: TestResult): TypedDataTestResult {
    const statusEmoji = ResultFormatter.getStatusEmoji(result.status);
    const data: {
      Description: string;
      Status: string;
      Timestamp: string;
      Error?: string;
    } = {
      Description: result.input.description || "No description",
      Status: `${statusEmoji} ${result.status.replace(/_/g, " ")}`,
      Timestamp: result.timestamp,
    };

    if (result.errorMessage) {
      data.Error = result.errorMessage;
    }

    return {
      title: "📋 TYPED DATA TEST RESULT",
      data,
      exitCode: result.status === "clear_signed" ? 0 : 1,
    };
  }
}
