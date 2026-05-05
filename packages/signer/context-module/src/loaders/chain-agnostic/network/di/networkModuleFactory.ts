import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/loaders/chain-agnostic/network/di/networkTypes";
import { networkClientFactory } from "@/loaders/chain-agnostic/network/networkClientFactory";

export const networkModuleFactory = (config: ContextModuleServiceConfig) =>
  new ContainerModule(({ bind }) => {
    bind<DmkNetworkClient>(networkTypes.NetworkClient).toConstantValue(
      networkClientFactory(config),
    );
  });
