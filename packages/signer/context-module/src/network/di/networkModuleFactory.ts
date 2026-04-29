import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";
import { networkClientFactory } from "@/network/networkClientFactory";

export const networkModuleFactory = (config: ContextModuleServiceConfig) =>
  new ContainerModule(({ bind }) => {
    bind<DmkNetworkClient>(networkTypes.NetworkClient).toConstantValue(
      networkClientFactory(config),
    );
  });
