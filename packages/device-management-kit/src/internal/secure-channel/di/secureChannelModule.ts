import { ContainerModule } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { SetWebSocketUrlUseCase } from "@internal/secure-channel/use-case/SetWebSocketUrlUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { secureChannelTypes } from "./secureChannelTypes";

type FactoryProps = {
  stub?: boolean;
  config: DmkConfig;
};

export const secureChannelModuleFactory = ({ stub, config }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(secureChannelTypes.DmkConfig).toConstantValue(config);

    bind(secureChannelTypes.SecureChannelDataSource)
      .to(DefaultSecureChannelDataSource)
      .inSingletonScope();
    bind(secureChannelTypes.SecureChannelService).to(
      DefaultSecureChannelService,
    );
    bind(secureChannelTypes.SetWebSocketUrlUseCase).to(SetWebSocketUrlUseCase);

    if (stub) {
      rebindSync(secureChannelTypes.SetWebSocketUrlUseCase).to(StubUseCase);
    }
  });
