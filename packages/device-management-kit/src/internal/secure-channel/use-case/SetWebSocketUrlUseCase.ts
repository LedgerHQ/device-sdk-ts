import { inject, injectable } from "inversify";

import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";

/**
 * Use case to set the secure channel WebSocket base URL at runtime.
 */
@injectable()
export class SetWebSocketUrlUseCase {
  constructor(
    @inject(secureChannelTypes.SecureChannelDataSource)
    private readonly secureChannelDataSource: SecureChannelDataSource,
  ) {}

  execute(webSocketUrl: string) {
    this.secureChannelDataSource.setWebSocketUrl(webSocketUrl);
  }
}
