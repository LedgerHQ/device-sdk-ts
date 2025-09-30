import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { SpeculosScreenReader } from "../adapters/SpeculosScreenReader";
import { ScreenContent } from "../../domain/models/ScreenContent";

/**
 * Infrastructure service for analyzing screen content
 * Contains business logic for screen content processing, analysis, and state management
 */
@injectable()
export class ScreenAnalyzerService {
    private readonly logger: LoggerPublisherService;
    private accumulatedTexts: string[] = [];

    constructor(
        @inject(TYPES.ScreenReader)
        private readonly screenReader: SpeculosScreenReader,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("screen-analyzer");
    }

    /**
     * Read screen content and apply business logic
     * Processes raw screen events into meaningful content and manages accumulation
     */
    async readScreenContent(): Promise<ScreenContent> {
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
    async getAndClearAccumulatedTexts(): Promise<string[]> {
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
        ];
        const isLastPage = lastPageTexts.some((text) =>
            data.text.toLowerCase().includes(text.toLowerCase()),
        );

        isLastPage
            ? this.logger.debug("Current screen is last page")
            : this.logger.debug("Current screen is not last page");

        return isLastPage;
    }

    /**
     * Check if the transaction can be refused
     * Business logic for detecting refusal options
     */
    async canRefuseTransaction(): Promise<boolean> {
        const data = await this.readScreenContent();
        const canRefuse = data.text.toLowerCase().includes("refu");

        canRefuse
            ? this.logger.debug("Transaction can be refused")
            : this.logger.debug("Transaction cannot be refused");

        return canRefuse;
    }

    /**
     * Check if current screen is the home page
     * Business logic for detecting home screens
     */
    async isHomePage(): Promise<boolean> {
        const data = await this.readScreenContent();
        const homePageTexts = ["This app enables signing", "app is ready"];
        const isHomePage = homePageTexts.some((text) =>
            data.text.toLowerCase().includes(text.toLowerCase()),
        );

        isHomePage
            ? this.logger.debug("Current screen is home page")
            : this.logger.debug("Current screen is not home page");

        return isHomePage;
    }
}
