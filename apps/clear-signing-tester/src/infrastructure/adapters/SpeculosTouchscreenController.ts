import axios from "axios";
import { inject, injectable } from "inversify";

import { type DeviceConnectionConfig } from "../../domain/repositories/DeviceRepository";
import { DeviceController } from "../../domain/adapters/DeviceController";
import { TYPES } from "../../di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { type DeviceMetadata } from "../../domain/metadata/DeviceMetadata";

/**
 * Speculos Touchscreen Device Controller
 *
 * Generic low-level device controller for sending HTTP commands to Speculos simulator
 * for touchscreen devices (Stax, Flex, Apex).
 * Uses device-specific metadata for coordinates and timing.
 * Provides pure device operations without business logic.
 * Application layer should orchestrate these operations based on business needs.
 */
@injectable()
export class SpeculosTouchscreenController implements DeviceController {
    private readonly speculosUrl: string;
    private readonly logger: LoggerPublisherService;
    private readonly deviceMetadata: DeviceMetadata;

    constructor(
        @inject(TYPES.DeviceConnectionConfig) config: DeviceConnectionConfig,
        @inject(TYPES.DeviceMetadata) deviceMetadata: DeviceMetadata,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.speculosUrl = config.speculosUrl;
        this.deviceMetadata = deviceMetadata;
        this.logger = loggerFactory("touchscreen-controller");
    }

    /**
     * Execute a sign operation by long-touching the sign button
     */
    async signTransaction(): Promise<void> {
        this.logger.debug("☝️ (touch) : Performing transaction sign");
        const { x, y } = this.deviceMetadata.coordinates.signButton;
        await this.longTouchDevice(x, y);
    }

    /**
     * Execute a reject operation by touching reject button and confirming
     */
    async rejectTransaction(): Promise<void> {
        this.logger.debug("☝️ (touch) : Performing transaction rejection");

        // Touch Reject button
        const rejectCoords = this.deviceMetadata.coordinates.rejectButton;
        await this.touchDevice(rejectCoords.x, rejectCoords.y);
        await this.delay(1000);

        // Confirm rejection
        const confirmCoords =
            this.deviceMetadata.coordinates.confirmRejectButton;
        await this.touchDevice(confirmCoords.x, confirmCoords.y);
    }

    /**
     * Reject transaction checks opt-in on the device
     */
    async rejectTransactionCheck(): Promise<void> {
        this.logger.debug("☝️ (touch) : Rejecting tx checks optin");
        const { x, y } = this.deviceMetadata.coordinates.acknowledgeButton;
        await this.touchDevice(x, y);
    }

    /**
     * Acknowledge blind signing on the device
     */
    async acknowledgeBlindSigning(): Promise<void> {
        this.logger.debug("☝️ (touch) : Acknowledging blind sign");
        const { x, y } = this.deviceMetadata.coordinates.acknowledgeButton;
        await this.touchDevice(x, y);
    }

    /**
     * Navigate to the next screen by pressing the right button
     */
    async navigateNext(): Promise<void> {
        this.logger.debug("☝️ (touch) : Navigating to next screen");
        const { x, y } = this.deviceMetadata.coordinates.navigationNext;
        await this.touchDevice(x, y);
    }

    /**
     * Navigate to the previous screen by pressing the left button
     */
    async navigatePrevious(): Promise<void> {
        this.logger.debug("☝️ (touch) : Navigating to previous screen");
        const { x, y } = this.deviceMetadata.coordinates.navigationPrevious;
        await this.touchDevice(x, y);
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
