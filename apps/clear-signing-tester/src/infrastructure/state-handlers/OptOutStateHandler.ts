import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SignableInput } from "@root/src/domain/models/SignableInput";

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

  async handle(ctx: { input: SignableInput }): Promise<StateHandlerResult> {
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
