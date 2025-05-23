import { ContainerModule } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";

import { secureChannelTypes } from "./secureChannelTypes";

type FactoryProps = {
  stub?: boolean;
  config: DmkConfig;
};

export const secureChannelModuleFactory = ({ stub, config }: FactoryProps) =>
  new ContainerModule(({ bind }) => {
    bind(secureChannelTypes.DmkConfig).toConstantValue(config);

    bind(secureChannelTypes.SecureChannelDataSource).to(
      DefaultSecureChannelDataSource,
    );
    bind(secureChannelTypes.SecureChannelService).to(
      DefaultSecureChannelService,
    );

    if (stub) {
      /* empty */
    }
  });
