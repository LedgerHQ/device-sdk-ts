import { StateHandler, StateHandlerResult } from "./StateHandler";
import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { inject, injectable } from "inversify";
import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { ScreenAnalyzerService } from "../ScreenAnalyzerService";
import type { RetryService } from "@root/src/domain/services/RetryService";
import type { DeviceController } from "@root/src/domain/adapters/DeviceController";

const WAIT_FOR_SIGN_SCREEN_MAX_ATTEMPTS = 5;
const WAIT_FOR_SIGN_SCREEN_DELAY = 1500;

@injectable()
export class CompleteStateHandler implements StateHandler {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
        @inject(TYPES.ScreenAnalyzerService)
        private readonly screenAnalyzer: ScreenAnalyzerService,
        @inject(TYPES.RetryService)
        private readonly retryService: RetryService,
        @inject(TYPES.DeviceController)
        private readonly deviceController: DeviceController,
    ) {
        this.logger = this.loggerFactory("complete-state-handler");
    }

    async handle(ctx: {
        input: TransactionInput | TypedDataInput;
    }): Promise<StateHandlerResult> {
        this.logger.debug("Complete state handler", {
            data: { ctx },
        });

        try {
            await this.waitUntilHomePage();
        } catch (error) {
            this.logger.error("Failed to detect home page", {
                data: { error },
            });

            if (await this.screenAnalyzer.canRefuseTransaction()) {
                await this.deviceController.rejectTransaction();
            }

            throw new Error("Home page not detected");
        }

        const analysis = await this.screenAnalyzer.analyzeAccumulatedTexts(
            ctx.input.expectedTexts || [],
        );

        if (analysis.containsAll) {
            return {
                status: "clear_signed",
            };
        } else {
            return {
                status: "partially_clear_signed",
            };
        }
    }

    private async waitUntilHomePage(): Promise<void> {
        try {
            await this.retryService.pollUntil(
                () => this.screenAnalyzer.isHomePage(),
                WAIT_FOR_SIGN_SCREEN_MAX_ATTEMPTS,
                WAIT_FOR_SIGN_SCREEN_DELAY,
            );
        } catch (error) {
            this.logger.error(
                "Failed to detect home page after maximum attempts",
            );
            throw new Error("Home page not detected after maximum attempts");
        }
    }
}
