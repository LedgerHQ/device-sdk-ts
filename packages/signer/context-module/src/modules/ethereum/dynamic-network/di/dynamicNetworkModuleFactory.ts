import { ContainerModule } from "inversify";

import { HttpDynamicNetworkDataSource } from "@/modules/ethereum/dynamic-network/data/HttpDynamicNetworkDataSource";
import { DynamicNetworkContextLoader } from "@/modules/ethereum/dynamic-network/domain/DynamicNetworkContextLoader";

import { dynamicNetworkTypes } from "./dynamicNetworkTypes";

export const dynamicNetworkModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(dynamicNetworkTypes.DynamicNetworkDataSource).to(
      HttpDynamicNetworkDataSource,
    );
    bind(dynamicNetworkTypes.DynamicNetworkContextLoader).to(
      DynamicNetworkContextLoader,
    );
  });
