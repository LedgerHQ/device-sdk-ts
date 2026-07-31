import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
} from "@ledgerhq/speculos-device-controller";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";

/**
 * Speculos Nano Device Controller
 *
 * Uses the new speculos-device-controller package for button-based interactions.
 * Supports Nano devices (NanoX, NanoS, NanoS+) without touchscreen.
 */
@injectable()
export class SpeculosNanoController implements DeviceController {
  private readonly logger: LoggerPublisherService;
  private readonly config: SpeculinhoConfig;
  private _buttons: ReturnType<DeviceControllerClient["buttonFactory"]> | null =
    null;

  private get buttons(): ReturnType<DeviceControllerClient["buttonFactory"]> {
    if (!this._buttons) {
      this._buttons = deviceControllerClientFactory(
        getEmulatorBaseUrl(this.config),
        {
          timeoutMs: this.config.speculosHttpTimeoutMs ?? 0,
        },
      ).buttonFactory();
    }
    return this._buttons;
  }

  constructor(
    @inject(TYPES.SpeculinhoConfig) config: SpeculinhoConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.config = config;
    this.logger = loggerFactory("nano-controller");
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

  async acceptBlindSigning(): Promise<void> {
    throw new Error(
      "Not implemented: acceptBlindSigning is only supported on touchscreen devices",
    );
  }

  async continueToBlindSigning(): Promise<void> {
    throw new Error(
      "Not implemented: continueToBlindSigning is only supported on touchscreen devices",
    );
  }

  async enableBlindSigningInSettings(): Promise<void> {
    throw new Error(
      "Not implemented: enableBlindSigningInSettings is only supported on touchscreen devices",
    );
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
