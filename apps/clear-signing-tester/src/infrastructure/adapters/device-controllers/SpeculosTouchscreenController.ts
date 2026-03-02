import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
  type PercentCoordinates,
} from "@ledgerhq/speculos-device-controller";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";

const DEFAULT_DELAY_MS = 5000;
const FLEX_DELAY_MS = 10000;

const SCREEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  stax: { width: 400, height: 672 },
  flex: { width: 480, height: 600 },
  apex: { width: 480, height: 600 },
};

const SETTINGS_NAV_MAX_ATTEMPTS = 10;
const SETTINGS_NAV_DELAY_MS = 1000;

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
  private readonly screenWidth: number;
  private readonly screenHeight: number;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.ScreenReader)
    private readonly screenReader: ScreenReader,
  ) {
    const speculosUrl = `${config.url}:${config.port}`;
    this.logger = loggerFactory("touchscreen-controller");

    const client = deviceControllerClientFactory(speculosUrl);
    this.tap = client.tapFactory(config.device);

    this.delayMs = config.device === "flex" ? FLEX_DELAY_MS : DEFAULT_DELAY_MS;

    const dims = SCREEN_DIMENSIONS[config.device] ?? {
      width: 400,
      height: 672,
    };
    this.screenWidth = dims.width;
    this.screenHeight = dims.height;

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
   * Tap "Continue to blind signing" on the "safer way to sign" screen
   */
  async continueToBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Tapping 'Continue to blind signing'");
    const events = await this.screenReader.readRawScreenEvents();
    const continueButton = this.findEventByPattern(
      events,
      /continue to blind signing/i,
    );
    if (continueButton) {
      await this.tapEventCenter(continueButton);
    } else {
      this.logger.debug(
        "Continue to blind signing button not found, falling back to mainButton",
      );
      await this.tap.mainButton();
    }
  }

  /**
   * Accept the "Blind signing ahead" warning by tapping "Accept risk and continue"
   */
  async acceptBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Accepting blind signing");
    const events = await this.screenReader.readRawScreenEvents();
    const acceptButton = this.findEventByPattern(
      events,
      /accept risk and continue/i,
    );
    if (acceptButton) {
      await this.tapEventCenter(acceptButton);
    } else {
      this.logger.debug("Accept button not found, falling back to mainButton");
      await this.tap.mainButton();
    }
  }

  /**
   * Navigate to Ethereum app settings from home and enable the blind signing toggle.
   * Taps the gear icon (top-right), finds "Blind signing" row, taps its toggle, then goes back.
   */
  async enableBlindSigningInSettings(): Promise<void> {
    this.logger.debug("☝️ (touch) : Tapping gear icon to open settings");
    await this.tap.enterMenu();
    await this.delay(SETTINGS_NAV_DELAY_MS);

    for (let i = 0; i < SETTINGS_NAV_MAX_ATTEMPTS; i++) {
      const events = await this.screenReader.readRawScreenEvents();
      const blindSigningLabel = this.findEventByPattern(
        events,
        /^blind signing$/i,
      );

      if (blindSigningLabel) {
        this.logger.debug("Found blind signing row, tapping toggle");
        await this.tap.enableBlindSigningSettings();
        await this.delay(SETTINGS_NAV_DELAY_MS);

        this.logger.debug("☝️ (touch) : Tapping back button");
        await this.tap.exitMenu();
        await this.delay(SETTINGS_NAV_DELAY_MS);

        this.logger.info("Blind signing enabled in settings");
        return;
      }

      this.logger.debug(
        "Blind signing not visible, navigating to next settings page",
      );
      await this.tap.navigateNext();
      await this.delay(SETTINGS_NAV_DELAY_MS);
    }

    throw new Error(
      "Failed to find blind signing toggle in settings after maximum attempts",
    );
  }

  private findEventByPattern(
    events: ScreenEvent[],
    pattern: RegExp,
  ): ScreenEvent | undefined {
    return events.find((e) => pattern.test(e.text));
  }

  private async tapEventCenter(event: ScreenEvent): Promise<void> {
    const percentX = Math.round(
      ((event.x + event.w / 2) / this.screenWidth) * 100,
    );
    const percentY = Math.round(
      ((event.y + event.h / 2) / this.screenHeight) * 100,
    );
    const clamped: PercentCoordinates = {
      x: Math.min(100, Math.max(0, percentX)) as PercentCoordinates["x"],
      y: Math.min(100, Math.max(0, percentY)) as PercentCoordinates["y"],
    };
    await this.tap.tapQuick(clamped);
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
