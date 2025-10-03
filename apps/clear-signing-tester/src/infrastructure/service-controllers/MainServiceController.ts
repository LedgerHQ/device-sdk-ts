import { inject, injectable } from "inversify";
import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

@injectable()
export class MainServiceController implements ServiceController {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.SpeculosServiceController)
        private readonly speculosController: ServiceController,
        @inject(TYPES.DMKServiceController)
        private readonly dmkController: ServiceController,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("main-service-controller");
    }

    async start(): Promise<void> {
        this.logger.info("Starting all services...");

        try {
            // Start in order: Speculos -> DMK
            await this.speculosController.start();
            await this.dmkController.start();

            this.logger.info("All services started successfully");
        } catch (error) {
            this.logger.error("Failed to start services", { data: { error } });
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.logger.info("Stopping all services...");

        // Stop in reverse order: DMK -> Speculos
        try {
            await this.dmkController.stop();
            await this.speculosController.stop();
        } catch (error) {
            this.logger.error("Failed to stop controller", {
                data: { error },
            });
        }

        this.logger.info("All services stopped successfully");
    }
}
