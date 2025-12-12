import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type ScreenContent } from "@root/src/domain/models/ScreenContent";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

/**
 * Infrastructure implementation for analyzing screen content
 * Contains business logic for screen content processing, analysis, and state management
 */
@injectable()
export class DefaultScreenAnalyzer implements ScreenAnalyzerService {
  private readonly logger: LoggerPublisherService;
  private accumulatedTexts: string[] = [];

  constructor(
    @inject(TYPES.ScreenReader)
    private readonly screenReader: ScreenReader,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("screen-analyzer");
  }

  /**
   * Analyze all accumulated screen texts for expected texts
   */
  async analyzeAccumulatedTexts(
    expectedTexts: string[],
  ): Promise<{ containsAll: boolean; found: string[]; missing: string[] }> {
    this.logger.debug("Analyzing accumulated screen texts", {
      data: { expectedTexts },
    });
    const accumulatedTexts = await this.getAndClearAccumulatedTexts();

    const found: string[] = [];
    const missing: string[] = [];

    for (const expectedText of expectedTexts) {
      const isFound = accumulatedTexts.some((screenText) =>
        screenText.toLowerCase().includes(expectedText.toLowerCase()),
      );

      if (isFound) {
        found.push(expectedText);
      } else {
        missing.push(expectedText);
      }
    }

    const containsAll = missing.length === 0;

    this.logger.debug("Analyzed accumulated screen texts", {
      data: {
        expectedTexts,
        found,
        missing,
        containsAll,
        totalAccumulatedTexts: accumulatedTexts.length,
      },
    });

    return { containsAll, found, missing };
  }

  /**
   * Check if current screen is the last page
   * Business logic for detecting signing screens
   */
  async isLastPage(): Promise<boolean> {
    const data = await this.readScreenContent();
    const lastPageTexts = [
      "sign transaction",
      "hold to sign",
      "sign message",
      "accept and send",
    ];
    const isLastPage = lastPageTexts.some((text) =>
      data.text.toLowerCase().includes(text.toLowerCase()),
    );

    if (isLastPage) {
      this.logger.debug("Current screen is last page");
    } else {
      this.logger.debug("Current screen is not last page");
    }

    return isLastPage;
  }

  /**
   * Check if the transaction can be refused
   * Business logic for detecting refusal options
   */
  async canRefuseTransaction(): Promise<boolean> {
    const data = await this.readScreenContent();
    const refuseTexts = ["refuse", "decline", "reject"];
    const canRefuse = refuseTexts.some((text) =>
      data.text.toLowerCase().includes(text.toLowerCase()),
    );

    if (canRefuse) {
      this.logger.debug("Transaction can be refused");
    } else {
      this.logger.debug("Transaction cannot be refused");
    }

    return canRefuse;
  }

  /**
   * Check if the current screen allows blind signing acknowledgement
   * Business logic for detecting acknowledgement options
   */
  async canAcknowledgeBlindSigning(): Promise<boolean> {
    const data = await this.readScreenContent();
    const acknowledgeTexts = ["reject"];
    const canAcknowledge = acknowledgeTexts.some((text) =>
      data.text.toLowerCase().includes(text.toLowerCase()),
    );

    if (canAcknowledge) {
      this.logger.debug("Current screen allows blind signing acknowledgement");
    } else {
      this.logger.debug(
        "Current screen does not allow blind signing acknowledgement",
      );
    }

    return canAcknowledge;
  }

  /**
   * Check if current screen is the home page
   * Business logic for detecting home screens
   */
  async isHomePage(): Promise<boolean> {
    const data = await this.readScreenContent();
    const homePageTexts = [
      "This app enables",
      "app is ready",
      "application is ready",
    ];
    const isHomePage = homePageTexts.some((text) =>
      data.text.toLowerCase().includes(text.toLowerCase()),
    );

    if (isHomePage) {
      this.logger.debug("Current screen is home page");
    } else {
      this.logger.debug("Current screen is not home page");
    }

    return isHomePage;
  }

  /**
   * Read screen content and apply business logic
   * Processes raw screen events into meaningful content and manages accumulation
   */
  private async readScreenContent(): Promise<ScreenContent> {
    try {
      const events = await this.screenReader.readRawScreenEvents();

      // Business logic: Extract and process text from events
      const screenText = events
        .filter((event) => event.text && event.text.trim())
        .map((event) => event.text.trim())
        .join(" ");

      // Business logic: Accumulate meaningful screen text
      if (screenText.trim()) {
        this.accumulatedTexts.push(screenText);
      }

      const content: ScreenContent = {
        text: screenText,
        timestamp: new Date(),
        isEmpty: !screenText.trim(),
      };

      this.logger.debug("Read screen content", {
        data: { content },
      });
      return content;
    } catch (error) {
      this.logger.error("Failed to read and process screen content", {
        data: { error },
      });

      return {
        text: "",
        timestamp: new Date(),
        isEmpty: true,
      };
    }
  }

  /**
   * Get all accumulated texts and clear the internal state
   * Business logic for managing screen text history
   */
  private getAndClearAccumulatedTexts(): string[] {
    const texts = [...this.accumulatedTexts];
    this.clearAccumulatedTexts();
    this.logger.debug("Retrieved and cleared accumulated texts", {
      data: { count: texts.length },
    });
    return texts;
  }

  /**
   * Clear accumulated screen texts (private business logic)
   */
  private clearAccumulatedTexts(): void {
    this.accumulatedTexts = [];
  }
}
