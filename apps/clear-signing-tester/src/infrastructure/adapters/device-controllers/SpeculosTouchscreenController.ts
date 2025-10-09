import {
  DeviceModelId,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
} from "@ledgerhq/speculos-device-controller";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

/**
 * Percentage-based coordinates for different device models
 * These are based on the actual UI layout of each device
 * Note: Percentages must be whole numbers (0-100) per the API requirement
 */
const DEVICE_COORDINATES = {
  [DeviceModelId.STAX]: {
    // Stax screen: 400x672
    // Rounded to nearest integer for type compatibility
    signButton: { x: 88, y: 82 }, // x: 350/400≈88%, y: 550/672≈82%
    rejectButton: { x: 20, y: 92 }, // x: 80/400=20%, y: 620/672≈92%
    confirmRejectButton: { x: 50, y: 82 }, // x: 200/400=50%, y: 550/672≈82%
    acknowledgeButton: { x: 50, y: 92 }, // x: 200/400=50%, y: 620/672≈92%
    navigationNext: { x: 88, y: 89 }, // x: 350/400≈88%, y: 600/672≈89%
    navigationPrevious: { x: 45, y: 89 }, // x: 180/400=45%, y: 600/672≈89%
  },
  [DeviceModelId.FLEX]: {
    // Flex screen: 480x600
    // TODO: Update these coordinates based on actual Flex device specifications
    // Current coordinates are placeholders
    signButton: { x: 0, y: 0 },
    rejectButton: { x: 0, y: 0 },
    confirmRejectButton: { x: 0, y: 0 },
    acknowledgeButton: { x: 0, y: 0 },
    navigationNext: { x: 0, y: 0 },
    navigationPrevious: { x: 0, y: 0 },
  },
} as const;

type SupportedTouchscreenDevice = keyof typeof DEVICE_COORDINATES;

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
  private readonly client: DeviceControllerClient;
  private readonly deviceModel: SupportedTouchscreenDevice;
  private readonly tap: ReturnType<DeviceControllerClient["tapFactory"]>;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService
  ) {
    const speculosUrl = `${config.url}:${config.port}`;
    this.logger = loggerFactory("touchscreen-controller");

    // Map device string to DeviceModelId
    const deviceModelMap: Partial<Record<string, SupportedTouchscreenDevice>> =
      {
        stax: DeviceModelId.STAX,
        flex: DeviceModelId.FLEX,
      };

    const mappedDevice = deviceModelMap[config.device];
    if (!mappedDevice) {
      throw new Error(`Unsupported touchscreen device: ${config.device}`);
    }
    this.deviceModel = mappedDevice;

    // Initialize the device controller client
    this.client = deviceControllerClientFactory(speculosUrl);
    this.tap = this.client.tapFactory(this.deviceModel);

    this.logger.info(
      `Initialized touchscreen controller for ${this.deviceModel}`
    );
  }

  /**
   * Execute a sign operation by long-touching the sign button
   */
  async signTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction sign");
    const coords = DEVICE_COORDINATES[this.deviceModel].signButton;
    await this.tap.tapLong(coords);
  }

  /**
   * Execute a reject operation by touching reject button and confirming
   */
  async rejectTransaction(): Promise<void> {
    this.logger.debug("☝️ (touch) : Performing transaction rejection");

    // Touch Reject button
    const rejectCoords = DEVICE_COORDINATES[this.deviceModel].rejectButton;
    await this.tap.tapQuick(rejectCoords);
    await this.delay(1000);

    // Confirm rejection
    const confirmCoords =
      DEVICE_COORDINATES[this.deviceModel].confirmRejectButton;
    await this.tap.tapQuick(confirmCoords);
  }

  /**
   * Reject transaction checks opt-in on the device
   */
  async rejectTransactionCheck(): Promise<void> {
    this.logger.debug("☝️ (touch) : Rejecting tx checks optin");
    const coords = DEVICE_COORDINATES[this.deviceModel].acknowledgeButton;
    await this.tap.tapQuick(coords);
  }

  /**
   * Acknowledge blind signing on the device
   */
  async acknowledgeBlindSigning(): Promise<void> {
    this.logger.debug("☝️ (touch) : Acknowledging blind sign");
    const coords = DEVICE_COORDINATES[this.deviceModel].acknowledgeButton;
    await this.tap.tapQuick(coords);
  }

  /**
   * Navigate to the next screen by pressing the right button
   */
  async navigateNext(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to next screen");
    const coords = DEVICE_COORDINATES[this.deviceModel].navigationNext;
    await this.tap.tapQuick(coords);
  }

  /**
   * Navigate to the previous screen by pressing the left button
   */
  async navigatePrevious(): Promise<void> {
    this.logger.debug("☝️ (touch) : Navigating to previous screen");
    const coords = DEVICE_COORDINATES[this.deviceModel].navigationPrevious;
    await this.tap.tapQuick(coords);
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
