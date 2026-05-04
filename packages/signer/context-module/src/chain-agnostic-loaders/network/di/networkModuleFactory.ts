import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { networkTypes } from "@/chain-agnostic-loaders/network/di/networkTypes";
import { networkClientFactory } from "@/chain-agnostic-loaders/network/networkClientFactory";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

export const networkModuleFactory = (config: ContextModuleServiceConfig) =>
  new ContainerModule(({ bind }) => {
    bind<DmkNetworkClient>(networkTypes.NetworkClient).toConstantValue(
      networkClientFactory(config),
    );
  });
