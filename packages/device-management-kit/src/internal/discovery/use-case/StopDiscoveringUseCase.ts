import { inject, injectable } from "inversify";

import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { type TransportService } from "@internal/transport/service/TransportService";

/**
 * Stops discovering devices connected.
 */
@injectable()
export class StopDiscoveringUseCase {
  constructor(
    @inject(transportDiTypes.TransportService)
    private transportService: TransportService,
  ) {}

  async execute(): Promise<void> {
    for (const transport of this.transportService.getAllTransports()) {
      await transport.stopDiscovering();
    }
  }
}
