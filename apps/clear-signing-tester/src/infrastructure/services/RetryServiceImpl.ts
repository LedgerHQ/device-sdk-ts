import { injectable, inject } from "inversify";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { TYPES } from "@root/src/di/types";
import { RetryService } from "@root/src/domain/services/RetryService";

@injectable()
export class RetryServiceImpl implements RetryService {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("retry-service");
    }

    async retryUntil<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxAttempts: number,
        delayMs: number,
    ): Promise<T> {
        this.logger.debug("Starting retry operation", {
            data: { maxAttempts, delayMs },
        });

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await operation();

                if (await condition(result)) {
                    this.logger.debug("Retry operation succeeded", {
                        data: { attempt, maxAttempts },
                    });
                    return result;
                }

                this.logger.debug("Condition not met, retrying", {
                    data: { attempt, maxAttempts },
                });

                if (attempt < maxAttempts) {
                    await this.delay(delayMs);
                }
            } catch (error) {
                this.logger.debug("Operation failed on attempt", {
                    data: { attempt, maxAttempts, error },
                });

                if (attempt === maxAttempts) {
                    throw error;
                }

                await this.delay(delayMs);
            }
        }

        const errorMessage = `Operation failed after ${maxAttempts} attempts`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    async retryUntilSuccess<T>(
        operation: () => Promise<T>,
        maxAttempts: number,
        delayMs: number,
    ): Promise<T> {
        return this.retryUntil(
            operation,
            () => true, // Any successful result is acceptable
            maxAttempts,
            delayMs,
        );
    }

    async pollUntil(
        checkCondition: () => Promise<boolean>,
        maxAttempts: number,
        delayMs: number,
    ): Promise<void> {
        await this.retryUntil(
            checkCondition,
            async (result) => result === true,
            maxAttempts,
            delayMs,
        );
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
