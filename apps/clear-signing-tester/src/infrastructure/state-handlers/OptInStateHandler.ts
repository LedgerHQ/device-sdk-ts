import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type CliLogLevel } from "@root/src/domain/models/config/LoggerConfig";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

import { type StateHandler, type StateHandlerResult } from "./StateHandler";

const WEB3_CHECKS_MODAL_MAX_ATTEMPTS = 6;
const WEB3_CHECKS_MODAL_POLL_DELAY_MS = 1000;
const WEB3_CHECKS_MODAL_SETTLE_DELAY_MS = 1500;
// Accepting shows a "Transaction Check enabled" screen that closes by itself
// after a few seconds, before the app answers the opt-in APDU.
const OPT_IN_CLOSE_MAX_ATTEMPTS = 10;
const OPT_IN_CLOSE_POLL_DELAY_MS = 1000;

/**
 * Accepts the Transaction Check opt-in, the counterpart of
 * {@link OptOutStateHandler} for scenarios that set `transactionCheckEnabled`.
 */
@injectable()
export class OptInStateHandler implements StateHandler {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.LogLevel)
    private readonly logLevel: CliLogLevel,
  ) {
    this.logger = this.loggerFactory("opt-in-state-handler");
  }

  async handle(ctx: { input: SignableInput }): Promise<StateHandlerResult> {
    this.logger.debug("Opt in state handler", {
      data: { ctx },
    });

    if (this.logLevel === "debug") {
      await this.screenshotSaver.save();
    }

    try {
      await this.retryService.pollUntil(
        async () => await this.screenAnalyzer.isWeb3ChecksOptInScreen(),
        WEB3_CHECKS_MODAL_MAX_ATTEMPTS,
        WEB3_CHECKS_MODAL_POLL_DELAY_MS,
      );
    } catch (_error) {
      this.logger.warn(
        "Web3 Checks opt-in modal did not render in time — skipping tap to avoid hitting an unintended screen element.",
      );
      return {
        status: "ongoing",
      };
    }

    await this.delay(WEB3_CHECKS_MODAL_SETTLE_DELAY_MS);

    if (this.logLevel === "debug") {
      const screenshotPath = await this.screenshotSaver.save();
      this.logger.debug("Screenshot before tapping opt-in modal", {
        data: { screenshotPath },
      });
    }

    await this.deviceController.acceptTransactionCheck();

    // Wait for the modal and its confirmation to close, so the review does not
    // start while a tap could still land on them.
    try {
      await this.retryService.pollUntil(
        async () => !(await this.screenAnalyzer.isTransactionCheckOptInShown()),
        OPT_IN_CLOSE_MAX_ATTEMPTS,
        OPT_IN_CLOSE_POLL_DELAY_MS,
      );
    } catch (_error) {
      await this.screenshotSaver.save();
      return {
        status: "error",
        errorMessage:
          "The Transaction Check opt-in was still on screen after accepting it",
      };
    }

    return {
      status: "ongoing",
    };
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
