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
const SETTINGS_NAV_DELAY_MS = 1000;

/**
 * Speculos Touchscreen Device Controller
 *
 * Uses the new speculos-device-controller package with percentage-based coordinates.
 * Supports Stax and Flex devices with touchscreen interfaces.
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

    const client = deviceControllerClientFactory(speculosUrl);
    this.tap = client.tapFactory(config.device);

    this.delayMs = config.device === "flex" ? FLEX_DELAY_MS : DEFAULT_DELAY_MS;

    this.logger.info(`Initialized touchscreen controller for ${config.device}`);
  }

  async signTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction sign");
    await this.tap.sign(this.delayMs);
  }

  async rejectTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction rejection");
    await this.tap.reject();
    await this.delay(1000);
    await this.tap.mainButton();
  }

  async rejectTransactionCheck(): Promise<void> {
    this.logger.debug("☝️ (touch) : Rejecting tx checks optin");
    await this.tap.secondaryButton();
  }

  async acknowledgeBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Acknowledging blind sign");
    await this.tap.secondaryButton();
  }

  async acceptBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Accepting blind signing");
    await this.tap.acceptBlindSigning();
  }

  async continueToBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Tapping 'Continue to blind signing'");
    await this.tap.continueToBlindSigning();
  }

  async enableBlindSigningInSettings(): Promise<void> {
    this.logger.debug("☝️ (touch) : Opening settings menu");
    await this.tap.openMenu();
    await this.delay(SETTINGS_NAV_DELAY_MS);

    this.logger.debug("☝️ (touch) : Tapping blind signing toggle");
    await this.tap.enableBlindSigningSettings();
    await this.delay(SETTINGS_NAV_DELAY_MS);

    this.logger.debug("☝️ (touch) : Closing settings menu");
    await this.tap.closeMenu();
    await this.delay(SETTINGS_NAV_DELAY_MS);

    this.logger.info("Blind signing enabled in settings");
  }

  async navigateNext(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to next screen");
    await this.tap.navigateNext();
  }

  async navigatePrevious(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to previous screen");
    await this.tap.navigatePrevious();
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
