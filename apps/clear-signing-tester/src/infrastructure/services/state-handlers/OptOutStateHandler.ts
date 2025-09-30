import { StateHandler, StateHandlerResult } from "./StateHandler";
import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";

@injectable()
export class OptOutStateHandler implements StateHandler {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
        @inject(TYPES.DeviceController)
        private readonly deviceController: DeviceController,
    ) {
        this.logger = this.loggerFactory("opt-out-state-handler");
    }

    async handle(ctx: {
        input: TransactionInput | TypedDataInput;
    }): Promise<StateHandlerResult> {
        this.logger.debug("Opt out state handler", {
            data: { ctx },
        });

        await this.deviceController.rejectTransactionCheck();

        return {
            status: "ongoing",
        };
    }
}
