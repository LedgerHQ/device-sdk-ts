import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

/**
 * Speculos Nano Device Controller
 *
 * Low-level device controller for sending HTTP commands to Speculos simulator for Nano devices.
 * Uses button-based interactions specific to Nano devices without touchscreen.
 * Provides pure device operations without business logic.
 * Application layer should orchestrate these operations based on business needs.
 */
@injectable()
export class SpeculosNanoController implements DeviceController {
    private readonly speculosUrl: string;
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.speculosUrl = `${config.url}:${config.port}`;
        this.logger = loggerFactory("nano-controller");
    }

    /**
     * Execute a sign operation by holding both buttons
     */
    async signTransaction(): Promise<void> {
        this.logger.debug("🔘 (buttons) : Performing transaction sign");
        await this.pressButton("both");
    }

    /**
     * Execute a reject operation by pressing the left button
     */
    async rejectTransaction(): Promise<void> {
        this.logger.debug("🔘 (buttons) : Performing transaction rejection");
        // Navigate to the reject screen at the end of the transaction flow
        for (let i = 0; i < 20; i++) {
            await this.pressButton("right");
        }
        // Confirm rejection by pressing both buttons simultaneously
        await this.pressButton("both");
    }

    /**
     * Reject transaction checks opt-in on the device
     */
    async rejectTransactionCheck(): Promise<void> {
        this.logger.debug(
            "🔘 (buttons) : No action needed for tx checks optin",
        );
        return Promise.resolve();
    }

    /**
     * Acknowledge blind signing on the device
     */
    async acknowledgeBlindSigning(): Promise<void> {
        this.logger.debug("🔘 (buttons) : Acknowledging blind sign");
        await this.pressButton("right");
        await this.pressButton("both");
    }

    /**
     * Navigate to the next screen by pressing the right button
     */
    async navigateNext(): Promise<void> {
        this.logger.debug("🔘 (buttons) : Navigating to next screen");
        await this.pressButton("right");
    }

    /**
     * Navigate to the previous screen by pressing the left button
     */
    async navigatePrevious(): Promise<void> {
        this.logger.debug("🔘 (buttons) : Navigating to previous screen");
        await this.pressButton("left");
    }

    /**
     * Send a button press command to the device simulator
     */
    private async pressButton(
        button: "left" | "right" | "both",
    ): Promise<void> {
        await this.delay(300);

        await axios.post(`${this.speculosUrl}/button/${button}`, {
            action: "press-and-release",
        });

        await this.delay(300);
    }

    /**
     * Utility method for delays
     */
    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}
