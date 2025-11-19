import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

import { type StateHandler, type StateHandlerResult } from "./StateHandler";

const NAVIGATION_MAX_ATTEMPTS = 20;
const NAVIGATION_DELAY = 200;
const WAIT_FOR_TX_PAGE_ATTEMPTS = 8;
const WAIT_FOR_TX_PAGE_DELAY = 1500;

@injectable()
export class SignTransactionStateHandler implements StateHandler {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
  ) {
    this.logger = this.loggerFactory("sign-transaction-state-handler");
  }

  async handle(ctx: {
    input: TransactionInput | TypedDataInput;
  }): Promise<StateHandlerResult> {
    this.logger.debug("Sign transaction state handler", {
      data: { ctx },
    });

    try {
      const navigated = await this.handleSmartSigning();

      if (navigated) {
        await this.deviceController.signTransaction();
        return {
          status: "ongoing",
        };
      }
      return {
        status: "error",
        errorMessage: "Failed to navigate to last screen",
      };
    } catch (error) {
      this.logger.error("Error during smart signing", {
        data: { error },
      });

      if (await this.screenAnalyzer.canRefuseTransaction()) {
        await this.deviceController.rejectTransaction();
      }

      return {
        status: "error",
        errorMessage: "Error during smart signing",
      };
    }
  }

  private async waitUntilTxPage(): Promise<void> {
    try {
      await this.retryService.pollUntil(
        async () => (await this.screenAnalyzer.isHomePage()) === false,
        WAIT_FOR_TX_PAGE_ATTEMPTS,
        WAIT_FOR_TX_PAGE_DELAY,
      );
    } catch (_error) {
      this.logger.error("Failed to detect tx page after maximum attempts");
      throw new Error("Tx page not detected after maximum attempts");
    }
  }

  /**
   * Handle smart signing - check for pagination first, then sign if needed
   * This method will navigate to the last screen if pagination is detected,
   * otherwise it will reject the transaction
   */
  private async handleSmartSigning(): Promise<boolean> {
    await this.waitUntilTxPage();

    this.logger.debug("Handling smart signing");
    return await this.navigateToLastScreen();
  }

  /**
   * Navigate to the last screen of a paginated transaction
   */
  private async navigateToLastScreen(): Promise<boolean> {
    this.logger.debug("Starting navigation to last screen");

    try {
      await this.retryService.retryUntil(
        async () => await this.deviceController.navigateNext(),
        async () => await this.screenAnalyzer.isLastPage(),
        NAVIGATION_MAX_ATTEMPTS,
        NAVIGATION_DELAY,
      );
    } catch (error) {
      this.logger.error("Error during navigation", {
        data: { error },
      });
      throw error;
    }

    return true;
  }
}
