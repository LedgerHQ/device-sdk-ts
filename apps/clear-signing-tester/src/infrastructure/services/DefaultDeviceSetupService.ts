import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type DeviceSetupService } from "@root/src/domain/services/DeviceSetupService";

@injectable()
export class DefaultDeviceSetupService implements DeviceSetupService {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SignerConfig)
    private readonly signerConfig: SignerConfig,
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("device-setup-service");
  }

  async setup(): Promise<void> {
    if (this.signerConfig.blindSigningEnabled) {
      this.logger.info("Enabling blind signing in device settings...");
      await this.deviceController.enableBlindSigningInSettings();
      this.logger.info("Blind signing enabled");
    }
  }
}
