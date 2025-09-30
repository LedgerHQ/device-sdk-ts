import axios from "axios";
import { inject, injectable } from "inversify";

import { type DeviceConnectionConfig } from "../../domain/repositories/DeviceRepository";
import { DeviceController } from "../../domain/adapters/DeviceController";
import { TYPES } from "../../di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";

/**
 * Speculos Stax Device Controller
 *
 * Low-level device controller for sending HTTP commands to Speculos simulator for Stax devices.
 * Uses touch-based interactions specific to Stax devices with touchscreen.
 * Provides pure device operations without business logic.
 * Application layer should orchestrate these operations based on business needs.
 */
@injectable()
export class SpeculosStaxController implements DeviceController {
    private readonly speculosUrl: string;
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.DeviceConnectionConfig) config: DeviceConnectionConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.speculosUrl = config.speculosUrl;
        this.logger = loggerFactory("stax-controller");
    }

    /**
     * Execute a sign operation by long-touching the sign button
     */
    async signTransaction(): Promise<void> {
        this.logger.debug("☝️ (touch) : Performing transaction sign");
        await this.longTouchDevice(350, 550);
    }

    /**
     * Execute a reject operation by touching reject button and confirming
     */
    async rejectTransaction(): Promise<void> {
        this.logger.debug("☝️ (touch) : Performing transaction rejection");
        // Touch Reject button
        await this.touchDevice(80, 620);
        await this.delay(1000);
        // Confirm rejection
        await this.touchDevice(200, 550);
    }

    /**
     * Reject transaction checks opt-in on the device
     */
    async rejectTransactionCheck(): Promise<void> {
        this.logger.debug("☝️ (touch) : Rejecting tx checks optin");
        await this.touchDevice(200, 620);
    }

    /**
     * Acknowledge blind signing on the device
     */
    async acknowledgeBlindSigning(): Promise<void> {
        this.logger.debug("☝️ (touch) : Acknowledging blind sign");
        await this.touchDevice(200, 620);
    }

    /**
     * Navigate to the next screen by pressing the right button
     */
    async navigateNext(): Promise<void> {
        this.logger.debug("☝️ (touch) : Navigating to next screen");
        await this.touchDevice(350, 600); // Right side of the screen
    }

    /**
     * Navigate to the previous screen by pressing the left button
     */
    async navigatePrevious(): Promise<void> {
        this.logger.debug("☝️ (touch) : Navigating to previous screen");
        await this.touchDevice(180, 600); // Left side of the screen
    }

    /**
     * Send a touch command to the device simulator
     */
    async touchDevice(x: number, y: number): Promise<void> {
        await this.delay(500);
        await axios.post(`${this.speculosUrl}/finger`, {
            action: "press-and-release",
            x,
            y,
        });
        await this.delay(500);
    }

    /**
     * Send a long touch command to the device simulator
     */
    async longTouchDevice(x: number, y: number): Promise<void> {
        await this.delay(200);
        await axios.post(`${this.speculosUrl}/finger`, {
            action: "press",
            x,
            y,
        });
        await this.delay(5000);
        await axios.post(`${this.speculosUrl}/finger`, {
            action: "release",
            x,
            y,
        });
        await this.delay(200);
    }

    /**
     * Utility method for delays
     */
    async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}
