import { inject, injectable } from "inversify";

import { TestResult } from "@root/src/domain/types/TestStatus";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";

export interface TypedDataTestConfig {
    readonly derivationPath: string;
}

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
    ): Promise<TestResult> {
        this.logger.debug("Executing typed object test", {
            data: { typedData, description: "single typed data" },
        });

        const result = await this.deviceRepository.performSignTypedData(
            typedData,
            config.derivationPath,
        );

        this.logger.info("Typed data test result", {
            data: { result },
        });

        return result;
    }
}
