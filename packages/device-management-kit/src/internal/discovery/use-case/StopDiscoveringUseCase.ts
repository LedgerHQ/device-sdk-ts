import { inject, injectable } from "inversify";

import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportService } from "@internal/transport/service/TransportService";

/**
 * Stops discovering devices connected.
 */
@injectable()
export class StopDiscoveringUseCase {
  constructor(
    @inject(transportDiTypes.TransportService)
    private transportService: TransportService,
  ) {}

  execute(): void {
    for (const transport of this.transportService.getAllTransports()) {
      transport.stopDiscovering();
    }
  }
}
