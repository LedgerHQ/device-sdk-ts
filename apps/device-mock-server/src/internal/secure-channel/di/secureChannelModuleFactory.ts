import { ContainerModule } from "inversify";

import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { SecureChannelApduService } from "@internal/secure-channel/service/SecureChannelApduService";
import { SecureChannelWebSocket } from "@internal/secure-channel/ws/SecureChannelWebSocket";

export const secureChannelModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(secureChannelTypes.ApduService)
      .to(SecureChannelApduService)
      .inSingletonScope();
    bind(secureChannelTypes.WebSocket)
      .to(SecureChannelWebSocket)
      .inSingletonScope();
  });
