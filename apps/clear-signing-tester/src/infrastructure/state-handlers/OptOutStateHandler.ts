import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";

import { type StateHandler, type StateHandlerResult } from "./StateHandler";

@injectable()
export class OptOutStateHandler implements StateHandler {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
  ) {
    this.logger = this.loggerFactory("opt-out-state-handler");
  }

  async handle(ctx: {
    input: TransactionInput | TypedDataInput;
  }): Promise<StateHandlerResult> {
    this.logger.debug("Opt out state handler", {
      data: { ctx },
    });

    await this.screenshotSaver.save();

    await this.deviceController.rejectTransactionCheck();

    return {
      status: "ongoing",
    };
  }
}
