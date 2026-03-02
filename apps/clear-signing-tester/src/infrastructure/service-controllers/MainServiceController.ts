import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceSetupService } from "@root/src/domain/services/DeviceSetupService";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

@injectable()
export class MainServiceController implements ServiceController {
  private readonly logger: LoggerPublisherService;
  private readonly controllers: ServiceController[];

  constructor(
    @inject(TYPES.ServiceControllers)
    controllers: ServiceController[],
    @inject(TYPES.DeviceSetupService)
    private readonly deviceSetupService: DeviceSetupService,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.controllers = controllers;
    this.logger = loggerFactory("main-service-controller");
  }

  async start(): Promise<void> {
    this.logger.info("Starting all services...");

    try {
      for (const controller of this.controllers) {
        await controller.start();
      }

      await this.deviceSetupService.setup();

      this.logger.info("All services started successfully");
    } catch (error) {
      this.logger.error("Failed to start services", { data: { error } });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping all services...");

    // Stop controllers in reverse order
    try {
      for (const controller of [...this.controllers].reverse()) {
        await controller.stop();
      }
    } catch (error) {
      this.logger.error("Failed to stop controller", {
        data: { error },
      });
    }

    this.logger.info("All services stopped successfully");
  }
}
