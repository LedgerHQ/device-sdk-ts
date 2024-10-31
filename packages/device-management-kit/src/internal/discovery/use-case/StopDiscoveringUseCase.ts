import { injectable, multiInject } from "inversify";

import type { Transport } from "@api/transport/model/Transport";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

/**
 * Stops discovering devices connected.
 */
@injectable()
export class StopDiscoveringUseCase {
  constructor(
    @multiInject(transportDiTypes.Transport)
    private transports: Transport[],
  ) {}

  execute(): void {
    for (const transport of this.transports) {
      transport.stopDiscovering();
    }
  }
}
