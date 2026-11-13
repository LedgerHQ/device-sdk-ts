import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import {
  TRANSACTION_CHECK_UNAVAILABLE,
  TRANSACTION_CHECK_VERDICTS,
} from "@root/src/domain/models/TransactionCheck";
import { type RetryService } from "@root/src/domain/services/RetryService";
import {
  type ScreenAnalyzerService,
  type ScreenTextAnalysis,
} from "@root/src/domain/services/ScreenAnalyzer";

import { type StateHandler, type StateHandlerResult } from "./StateHandler";

const WAIT_FOR_SIGN_SCREEN_MAX_ATTEMPTS = 5;
const WAIT_FOR_SIGN_SCREEN_DELAY = 1500;

/** Why a Transaction Check case failed, or nothing when its verdict showed. */
function transactionCheckFailure(
  analysis: ScreenTextAnalysis,
): string | undefined {
  if (analysis.forbidden.includes(TRANSACTION_CHECK_UNAVAILABLE)) {
    return `The review showed "${TRANSACTION_CHECK_UNAVAILABLE}": no valid report reached the device`;
  }
  if (analysis.foundOneOf.length === 0) {
    return "The review showed no Transaction Check verdict";
  }
  return undefined;
}

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
    @inject(TYPES.SignerConfig)
    private readonly signerConfig: SignerConfig,
  ) {
    this.logger = this.loggerFactory("complete-state-handler");
  }

  async handle(ctx: { input: SignableInput }): Promise<StateHandlerResult> {
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

      throw new Error("Home page not detected");
    }

    // With Transaction Check on, the review must carry the live verdict. Without
    // one, the report never reached the device or failed its checks there.
    const transactionCheck = this.signerConfig.transactionCheckEnabled;
    const analysis = await this.screenAnalyzer.analyzeAccumulatedTexts(
      ctx.input.expectedTexts || [],
      [
        ...(ctx.input.unexpectedTexts || []),
        ...(transactionCheck ? [TRANSACTION_CHECK_UNAVAILABLE] : []),
      ],
      transactionCheck ? TRANSACTION_CHECK_VERDICTS : [],
    );

    if (transactionCheck && analysis.foundOneOf.length > 0) {
      this.logger.info(
        `Transaction Check verdict: ${analysis.foundOneOf.join(", ")}`,
      );
    }

    if (analysis.containsAll) {
      return {
        status: "clear_signed",
      };
    } else {
      const errorMessage = transactionCheck
        ? transactionCheckFailure(analysis)
        : undefined;
      return {
        status: "partially_clear_signed",
        ...(errorMessage ? { errorMessage } : {}),
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
    } catch (_error) {
      this.logger.error("Failed to detect home page after maximum attempts");
      throw new Error("Home page not detected after maximum attempts");
    }
  }
}
