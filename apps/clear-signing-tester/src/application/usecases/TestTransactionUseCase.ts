import { inject, injectable } from "inversify";

import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { TestResult } from "@root/src/domain/types/TestStatus";

export interface TransactionTestConfig {
    readonly derivationPath: string;
}

@injectable()
export class TestTransactionUseCase {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.DeviceRepository)
        private readonly deviceRepository: DeviceRepository,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("test-transaction");
    }

    async execute(
        transaction: TransactionInput,
        config: TransactionTestConfig,
    ): Promise<TestResult> {
        this.logger.debug("Executing transaction test", {
            data: { description: transaction.description },
        });

        const result = await this.deviceRepository.performSignTransaction(
            transaction,
            config.derivationPath,
        );

        this.logger.info("Transaction test result", {
            data: { result },
        });

        return result;
    }
}
