import { inject, injectable } from "inversify";

import { LoggerPublisherService } from "@api/types";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { type TransportService } from "@internal/transport/service/TransportService";

/**
 * Stops discovering devices connected.
 */
@injectable()
export class StopDiscoveringUseCase {
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(transportDiTypes.TransportService)
    private transportService: TransportService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("StopDiscoveringUseCase");
  }

  async execute(): Promise<void> {
    this._logger.debug("Stopping discovering devices");
    for (const transport of this.transportService.getAllTransports()) {
      await transport.stopDiscovering();
    }
  }
}
