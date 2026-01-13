import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
} from "@ledgerhq/speculos-device-controller";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

const DEFAULT_DELAY_MS = 5000;
const FLEX_DELAY_MS = 10000;

/**
 * Speculos Touchscreen Device Controller
 *
 * Uses the new speculos-device-controller package with percentage-based coordinates.
 * Supports Stax and Flex devices with touchscreen interfaces.
 * Uses device-specific coordinate mappings defined in DEVICE_COORDINATES.
 */
@injectable()
export class SpeculosTouchscreenController implements DeviceController {
  private readonly logger: LoggerPublisherService;
  private readonly tap: ReturnType<DeviceControllerClient["tapFactory"]>;
  private readonly delayMs: number;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    const speculosUrl = `${config.url}:${config.port}`;
    this.logger = loggerFactory("touchscreen-controller");

    // Initialize the device controller client
    const client = deviceControllerClientFactory(speculosUrl);
    this.tap = client.tapFactory(config.device);

    this.delayMs = config.device === "flex" ? FLEX_DELAY_MS : DEFAULT_DELAY_MS;

    this.logger.info(`Initialized touchscreen controller for ${config.device}`);
  }

  /**
   * Execute a sign operation by long-touching the sign button
   */
  async signTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction sign");
    await this.tap.sign(this.delayMs);
  }

  /**
   * Execute a reject operation by touching reject button and confirming
   */
  async rejectTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction rejection");

    await this.tap.reject();
    await this.delay(1000);
    await this.tap.mainButton();
  }

  /**
   * Reject transaction checks opt-in on the device
   */
  async rejectTransactionCheck(): Promise<void> {
    this.logger.debug("☝️ (touch) : Rejecting tx checks optin");
    await this.tap.secondaryButton();
  }

  /**
   * Acknowledge blind signing on the device
   */
  async acknowledgeBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Acknowledging blind sign");
    await this.tap.secondaryButton();
  }

  /**
   * Navigate to the next screen by pressing the right button
   */
  async navigateNext(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to next screen");
    await this.tap.navigateNext();
  }

  /**
   * Navigate to the previous screen by pressing the left button
   */
  async navigatePrevious(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to previous screen");
    await this.tap.navigatePrevious();
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
