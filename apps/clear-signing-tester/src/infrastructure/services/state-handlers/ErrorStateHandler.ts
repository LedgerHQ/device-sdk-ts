import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { ScreenAnalyzerService } from "../ScreenAnalyzerService";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { StateHandlerResult, type StateHandler } from "./StateHandler";
import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";

@injectable()
export class ErrorStateHandler implements StateHandler {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
        @inject(TYPES.ScreenAnalyzerService)
        private readonly screenAnalyzer: ScreenAnalyzerService,
        @inject(TYPES.DeviceController)
        private readonly deviceController: DeviceController,
    ) {
        this.logger = this.loggerFactory("error-state-handler");
    }

    async handle(ctx: {
        input: TransactionInput | TypedDataInput;
    }): Promise<StateHandlerResult> {
        this.logger.debug("Error state handler", {
            data: { ctx: JSON.stringify(ctx) },
        });

        if (await this.screenAnalyzer.canRefuseTransaction()) {
            await this.deviceController.rejectTransaction();
        } else {
            await this.deviceController.acknowledgeBlindSigning();
        }

        return {
            status: "blind_signed",
            errorMessage: "Transaction requires blind signing",
        };
    }
}
