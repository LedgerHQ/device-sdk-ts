import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
} from "@ledgerhq/speculos-device-controller";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

/**
 * Speculos Nano Device Controller
 *
 * Uses the new speculos-device-controller package for button-based interactions.
 * Supports Nano devices (NanoX, NanoS, NanoS+) without touchscreen.
 */
@injectable()
export class SpeculosNanoController implements DeviceController {
  private readonly logger: LoggerPublisherService;
  private readonly buttons: ReturnType<DeviceControllerClient["buttonFactory"]>;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    const speculosUrl = `${config.url}:${config.port}`;
    this.logger = loggerFactory("nano-controller");

    // Initialize the device controller client
    const client = deviceControllerClientFactory(speculosUrl);
    this.buttons = client.buttonFactory();

    this.logger.info("Initialized nano button controller");
  }

  /**
   * Execute a sign operation by holding both buttons
   */
  async signTransaction(): Promise<void> {
    this.logger.debug("🔘 (buttons) : Performing transaction sign");
    await this.buttons.both();
  }

  /**
   * Execute a reject operation by pressing the left button
   */
  async rejectTransaction(): Promise<void> {
    this.logger.debug("🔘 (buttons) : Performing transaction rejection");
    // Navigate to the reject screen at the end of the transaction flow
    const navigationKeys = Array(20).fill("right") as Array<"right">;
    await this.buttons.pressSequence(navigationKeys);
    // Confirm rejection by pressing both buttons simultaneously
    await this.buttons.both();
  }

  /**
   * Reject transaction checks opt-in on the device
   */
  async rejectTransactionCheck(): Promise<void> {
    this.logger.debug("🔘 (buttons) : No action needed for tx checks optin");
    return Promise.resolve();
  }

  /**
   * Acknowledge blind signing on the device
   */
  async acknowledgeBlindSigning(): Promise<void> {
    this.logger.debug("🔘 (buttons) : Acknowledging blind sign");
    await this.buttons.right();
    await this.buttons.both();
  }

  /**
   * Navigate to the next screen by pressing the right button
   */
  async navigateNext(): Promise<void> {
    this.logger.debug("🔘 (buttons) : Navigating to next screen");
    await this.buttons.right();
  }

  /**
   * Navigate to the previous screen by pressing the left button
   */
  async navigatePrevious(): Promise<void> {
    this.logger.debug("🔘 (buttons) : Navigating to previous screen");
    await this.buttons.left();
  }
}
