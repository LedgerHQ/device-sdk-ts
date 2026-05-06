import { ContainerModule } from "inversify";

import { HttpDynamicNetworkDataSource } from "@/modules/ethereum/dynamic-network/data/HttpDynamicNetworkDataSource";
import { DynamicNetworkContextLoader } from "@/modules/ethereum/dynamic-network/domain/DynamicNetworkContextLoader";

import { ethereumDynamicNetworkTypes } from "./ethereumDynamicNetworkTypes";

export const dynamicNetworkModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumDynamicNetworkTypes.EthereumDynamicNetworkDataSource).to(
      HttpDynamicNetworkDataSource,
    );
    bind(ethereumDynamicNetworkTypes.EthereumDynamicNetworkContextLoader).to(
      DynamicNetworkContextLoader,
    );
  });
