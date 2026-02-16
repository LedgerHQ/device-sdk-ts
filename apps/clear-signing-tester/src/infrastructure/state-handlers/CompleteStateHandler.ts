import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

import { type StateHandler, type StateHandlerResult } from "./StateHandler";

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
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
  ) {
    this.logger = this.loggerFactory("complete-state-handler");
  }

  async handle(ctx: {
    input: TransactionInput | TypedDataInput;
  }): Promise<StateHandlerResult> {
    this.logger.debug("Complete state handler", {
      data: { ctx },
    });

    await this.screenshotSaver.save();

    try {
      await this.waitUntilHomePage();
    } catch (error) {
      this.logger.error("Failed to detect home page", {
        data: { error },
      });

      if (await this.screenAnalyzer.canRefuseTransaction()) {
        await this.deviceController.rejectTransaction();
      }

      throw new Error("Home page not detected", { cause: error });
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
      this.logger.error("Failed to detect home page after maximum attempts");
      throw new Error("Home page not detected after maximum attempts", {
        cause: error,
      });
    }
  }
}
