import { inject, injectable } from "inversify";

import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { LoggerPublisherService } from "@api/types";
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
  ) {
    this._logger = getLogger("StopDiscoveringUseCase");
  }

  async execute(): Promise<void> {
    this._logger.debug("Stopping discovering devices");
    for (const transport of this.transportService.getAllTransports()) {
      await transport.stopDiscovering();
    }
  }
}
